/**
 * Lead Service
 *
 * Business logic for lead management operations.
 * Handles CRUD operations, validation, event publishing, and activity logging.
 */

import {
  Lead,
  LeadWithScore,
  CreateLeadRequest,
  UpdateLeadRequest,
  LeadListQuery,
  LeadListResponse,
  LeadStatus,
  QualificationStatus,
} from '../models/Lead';
import { ActivityAction } from '../models/ActivityLog';
import { UserRole } from '../models/User';
import {
  executeQuery,
  executeQueryOne,
  executeQueryAll,
  executeTransaction,
} from '../lib/database';
import { logger } from '../lib/logger';
import { ConflictError, NotFoundError } from '../api/middleware/errorHandler';
import {
  publishLeadCreated,
  publishLeadUpdated,
  publishLeadDeleted,
} from './DaprPubSubService';
import {
  getCached,
  setCached,
  invalidateLeadCaches,
  CacheNamespace,
  generateLeadListCacheKey,
  generateLeadDetailCacheKey,
  getOrCompute,
} from './DaprStateService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new lead
 *
 * @param request - Lead creation data
 * @param createdBy - User ID who is creating the lead
 * @returns Created lead with ID
 */
export async function createLead(
  request: CreateLeadRequest,
  createdBy: string
): Promise<Lead> {
  const leadId = uuidv4();

  try {
    logger.info(
      {
        leadId,
        email: request.email,
        createdBy,
      },
      'Creating new lead'
    );

    // Execute lead creation in a transaction
    const lead = await executeTransaction(async (client) => {
      // Check for duplicate email
      const duplicateCheck = await client.query(
        'SELECT id, email FROM leads WHERE email = $1',
        [request.email.toLowerCase()]
      );

      if (duplicateCheck.rows.length > 0) {
        logger.warn(
          {
            email: request.email,
            existingLeadId: duplicateCheck.rows[0].id,
          },
          'Duplicate email detected'
        );

        throw new ConflictError(
          `Lead with email "${request.email}" already exists`,
          {
            existingLeadId: duplicateCheck.rows[0].id,
            email: request.email,
          }
        );
      }

      // Insert new lead
      const insertQuery = `
        INSERT INTO leads (
          id,
          name,
          email,
          phone,
          company,
          lead_source,
          status,
          qualification_status,
          assigned_to,
          created_by,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      const insertResult = await client.query<Lead>(insertQuery, [
        leadId,
        request.name.trim(),
        request.email.toLowerCase(),
        request.phone || null,
        request.company?.trim() || null,
        request.leadSource,
        LeadStatus.NEW, // Default status
        QualificationStatus.NOT_QUALIFIED, // Default qualification status
        null, // assigned_to (unassigned by default)
        createdBy,
        JSON.stringify(request.metadata || {}),
      ]);

      const newLead = insertResult.rows[0];

      // Create activity log entry
      const activityLogQuery = `
        INSERT INTO activity_logs (
          id,
          lead_id,
          user_id,
          action,
          description,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
        )
      `;

      await client.query(activityLogQuery, [
        uuidv4(),
        leadId,
        createdBy,
        ActivityAction.CREATE,
        `Lead "${newLead.name}" created`,
        JSON.stringify({
          leadSource: request.leadSource,
          company: request.company,
          initialMetadata: request.metadata,
        }),
      ]);

      logger.info(
        {
          leadId: newLead.id,
          email: newLead.email,
          name: newLead.name,
        },
        'Lead created successfully in database'
      );

      return newLead;
    });

    // Publish lead.created event (outside transaction, best effort)
    try {
      await publishLeadCreated({
        leadId: lead.id,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        leadSource: lead.lead_source,
        assignedTo: lead.assigned_to,
        createdBy: lead.created_by!,
      });

      logger.info(
        {
          leadId: lead.id,
        },
        'Lead created event published'
      );
    } catch (eventError) {
      // Log event publishing error but don't fail the request
      logger.error(
        {
          error: eventError,
          leadId: lead.id,
        },
        'Failed to publish lead.created event (non-fatal)'
      );
    }

    return lead;
  } catch (error) {
    // If it's a ConflictError, rethrow it
    if (error instanceof ConflictError) {
      throw error;
    }

    logger.error(
      {
        error,
        email: request.email,
        createdBy,
      },
      'Failed to create lead'
    );

    throw error;
  }
}

/**
 * Get lead by ID
 *
 * @param leadId - Lead UUID
 * @returns Lead or null if not found
 */
export async function getLeadById(leadId: string): Promise<Lead | null> {
  const query = 'SELECT * FROM leads WHERE id = $1';

  try {
    const lead = await executeQueryOne<Lead>(query, [leadId]);

    if (!lead) {
      logger.debug({ leadId }, 'Lead not found');
      return null;
    }

    logger.debug({ leadId }, 'Lead retrieved successfully');
    return lead;
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to get lead by ID');
    throw error;
  }
}

/**
 * Get lead by ID with latest score
 *
 * @param leadId - Lead UUID
 * @returns Lead with score or null if not found
 */
export async function getLeadWithScoreById(
  leadId: string
): Promise<LeadWithScore | null> {
  const query = `
    SELECT
      l.*,
      ls.id AS score_id,
      ls.budget_score,
      ls.authority_score,
      ls.need_score,
      ls.timeline_score,
      ls.total_score,
      ls.reasoning,
      ls.confidence,
      ls.created_at AS score_created_at
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT * FROM lead_scores
      WHERE lead_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) ls ON true
    WHERE l.id = $1
  `;

  try {
    const result = await executeQueryOne<any>(query, [leadId]);

    if (!result) {
      logger.debug({ leadId }, 'Lead not found');
      return null;
    }

    // Transform result into LeadWithScore
    const lead: LeadWithScore = {
      id: result.id,
      name: result.name,
      email: result.email,
      phone: result.phone,
      company: result.company,
      lead_source: result.lead_source,
      status: result.status,
      qualification_status: result.qualification_status,
      assigned_to: result.assigned_to,
      created_by: result.created_by,
      metadata: result.metadata,
      created_at: result.created_at,
      updated_at: result.updated_at,
      last_contacted_at: result.last_contacted_at,
      converted_at: result.converted_at,
      lead_score: result.score_id
        ? {
            id: result.score_id,
            lead_id: result.id,
            budget_score: result.budget_score,
            authority_score: result.authority_score,
            need_score: result.need_score,
            timeline_score: result.timeline_score,
            total_score: result.total_score,
            reasoning: result.reasoning,
            confidence: result.confidence,
            created_at: result.score_created_at,
          }
        : null,
    };

    logger.debug({ leadId }, 'Lead with score retrieved successfully');
    return lead;
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to get lead with score');
    throw error;
  }
}

/**
 * Check if lead exists by ID
 *
 * @param leadId - Lead UUID
 * @returns True if lead exists, false otherwise
 */
export async function leadExists(leadId: string): Promise<boolean> {
  const query = 'SELECT EXISTS(SELECT 1 FROM leads WHERE id = $1) as exists';

  try {
    const result = await executeQueryOne<{ exists: boolean }>(query, [leadId]);
    return result?.exists || false;
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to check if lead exists');
    throw error;
  }
}

/**
 * Get lead by ID or throw NotFoundError
 *
 * @param leadId - Lead UUID
 * @returns Lead
 * @throws NotFoundError if lead not found
 */
export async function getLeadByIdOrFail(leadId: string): Promise<Lead> {
  const lead = await getLeadById(leadId);

  if (!lead) {
    throw new NotFoundError(`Lead with ID "${leadId}" not found`);
  }

  return lead;
}

/**
 * List leads with filtering, pagination, and search
 * Implements RBAC filtering and Redis caching
 *
 * @param query - Filter, pagination, and search parameters
 * @param user - Authenticated user (for RBAC filtering)
 * @returns Paginated list of leads with scores
 */
export async function listLeads(
  query: LeadListQuery,
  user: { userId: string; role: UserRole }
): Promise<LeadListResponse> {
  const {
    page = 1,
    limit = 20,
    status,
    qualification_status,
    lead_source,
    assigned_to,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = query;

  try {
    logger.info(
      {
        userId: user.userId,
        userRole: user.role,
        page,
        limit,
        filters: { status, qualification_status, lead_source, assigned_to, search },
      },
      'Listing leads'
    );

    // Generate cache key
    const cacheKey = generateLeadListCacheKey({
      ...query,
      userId: user.userId,
      userRole: user.role,
    });

    // Try to get from cache
    const cachedResult = await getOrCompute<LeadListResponse>(
      CacheNamespace.LEAD_LIST,
      cacheKey,
      async () => {
        // Build WHERE clause with RBAC filtering
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        // RBAC filtering
        if (user.role === UserRole.SALES_REP) {
          // Sales reps can only see assigned leads
          conditions.push(`l.assigned_to = $${paramIndex++}`);
          params.push(user.userId);
        } else if (user.role === UserRole.MANAGER) {
          // Managers can see all leads (simplified - team filtering TBD)
          // No additional filter
        } else if (user.role === UserRole.ADMIN) {
          // Admins can see all leads
          // No additional filter
        }

        // Status filter
        if (status) {
          conditions.push(`l.status = $${paramIndex++}`);
          params.push(status);
        }

        // Qualification status filter
        if (qualification_status) {
          conditions.push(`l.qualification_status = $${paramIndex++}`);
          params.push(qualification_status);
        }

        // Lead source filter
        if (lead_source) {
          conditions.push(`l.lead_source = $${paramIndex++}`);
          params.push(lead_source);
        }

        // Assigned to filter
        if (assigned_to) {
          conditions.push(`l.assigned_to = $${paramIndex++}`);
          params.push(assigned_to);
        }

        // Search filter (name, email, company)
        if (search) {
          conditions.push(
            `(l.name ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex} OR l.company ILIKE $${paramIndex})`
          );
          params.push(`%${search}%`);
          paramIndex++;
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total results
        const countQuery = `SELECT COUNT(*) as count FROM leads l ${whereClause}`;
        const countResult = await executeQueryOne<{ count: string }>(
          countQuery,
          params
        );
        const total = parseInt(countResult?.count || '0', 10);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);

        // Build data query with LEFT JOIN LATERAL for latest score
        const dataQuery = `
          SELECT
            l.*,
            ls.id AS score_id,
            ls.budget_score,
            ls.authority_score,
            ls.need_score,
            ls.timeline_score,
            ls.total_score,
            ls.reasoning,
            ls.confidence,
            ls.created_at AS score_created_at
          FROM leads l
          LEFT JOIN LATERAL (
            SELECT * FROM lead_scores
            WHERE lead_id = l.id
            ORDER BY created_at DESC
            LIMIT 1
          ) ls ON true
          ${whereClause}
          ORDER BY l.${sortBy} ${sortOrder.toUpperCase()}
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        const dataResult = await executeQueryAll<any>(dataQuery, [
          ...params,
          limit,
          offset,
        ]);

        // Transform results into LeadWithScore objects
        const leads: LeadWithScore[] = dataResult.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          lead_source: row.lead_source,
          status: row.status,
          qualification_status: row.qualification_status,
          assigned_to: row.assigned_to,
          created_by: row.created_by,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at,
          last_contacted_at: row.last_contacted_at,
          converted_at: row.converted_at,
          lead_score: row.score_id
            ? {
                id: row.score_id,
                lead_id: row.id,
                budget_score: row.budget_score,
                authority_score: row.authority_score,
                need_score: row.need_score,
                timeline_score: row.timeline_score,
                total_score: row.total_score,
                reasoning: row.reasoning,
                confidence: row.confidence,
                created_at: row.score_created_at,
              }
            : null,
        }));

        const response: LeadListResponse = {
          data: leads,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
          meta: {
            filters: { status, qualification_status, lead_source, assigned_to, search },
          },
        };

        logger.info(
          {
            userId: user.userId,
            resultsCount: leads.length,
            total,
            page,
            totalPages,
          },
          'Leads listed successfully'
        );

        return response;
      },
      300 // 5-minute TTL
    );

    return cachedResult;
  } catch (error) {
    logger.error(
      {
        error,
        userId: user.userId,
        query,
      },
      'Failed to list leads'
    );
    throw error;
  }
}

/**
 * Update lead with partial update and optimistic locking
 *
 * @param leadId - Lead UUID
 * @param request - Partial update data
 * @param updatedBy - User ID who is updating the lead
 * @param previousUpdatedAt - Previous updated_at timestamp for optimistic locking (optional)
 * @returns Updated lead
 */
export async function updateLead(
  leadId: string,
  request: UpdateLeadRequest,
  updatedBy: string,
  previousUpdatedAt?: Date
): Promise<Lead> {
  try {
    logger.info(
      {
        leadId,
        updatedBy,
        updateFields: Object.keys(request),
      },
      'Updating lead'
    );

    // Execute update in a transaction
    const { lead, changedFields, previousValues, newValues } =
      await executeTransaction(async (client) => {
        // Get current lead for comparison and optimistic locking
        const currentLead = await client.query<Lead>(
          'SELECT * FROM leads WHERE id = $1',
          [leadId]
        );

        if (currentLead.rows.length === 0) {
          throw new NotFoundError(`Lead with ID "${leadId}" not found`);
        }

        const current = currentLead.rows[0];

        // Optimistic locking check
        if (previousUpdatedAt) {
          const currentUpdatedAt = new Date(current.updated_at).getTime();
          const providedUpdatedAt = new Date(previousUpdatedAt).getTime();

          if (currentUpdatedAt !== providedUpdatedAt) {
            logger.warn(
              {
                leadId,
                currentUpdatedAt: current.updated_at,
                providedUpdatedAt: previousUpdatedAt,
              },
              'Optimistic locking conflict detected'
            );

            throw new ConflictError(
              'Lead was modified by another user. Please refresh and try again.',
              {
                currentUpdatedAt: current.updated_at,
                providedUpdatedAt: previousUpdatedAt,
              }
            );
          }
        }

        // Check for duplicate email if email is being changed
        if (request.email && request.email !== current.email) {
          const duplicateCheck = await client.query(
            'SELECT id FROM leads WHERE email = $1 AND id != $2',
            [request.email.toLowerCase(), leadId]
          );

          if (duplicateCheck.rows.length > 0) {
            throw new ConflictError(
              `Lead with email "${request.email}" already exists`,
              {
                existingLeadId: duplicateCheck.rows[0].id,
                email: request.email,
              }
            );
          }
        }

        // Build dynamic UPDATE query
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        const changedFields: string[] = [];
        const previousValues: Record<string, any> = {};
        const newValues: Record<string, any> = {};

        // Helper to add field update
        const addUpdate = (
          field: string,
          dbColumn: string,
          value: any,
          transform?: (val: any) => any
        ) => {
          const currentValue = (current as any)[dbColumn];
          const newValue = transform ? transform(value) : value;

          if (newValue !== currentValue) {
            updates.push(`${dbColumn} = $${paramIndex++}`);
            params.push(newValue);
            changedFields.push(field);
            previousValues[field] = currentValue;
            newValues[field] = newValue;
          }
        };

        // Apply updates for each field
        if (request.name !== undefined) {
          addUpdate('name', 'name', request.name, (v) => v.trim());
        }

        if (request.email !== undefined) {
          addUpdate('email', 'email', request.email, (v) => v.toLowerCase());
        }

        if (request.phone !== undefined) {
          addUpdate('phone', 'phone', request.phone);
        }

        if (request.company !== undefined) {
          addUpdate('company', 'company', request.company, (v) =>
            v ? v.trim() : null
          );
        }

        if (request.status !== undefined) {
          addUpdate('status', 'status', request.status);
        }

        if (request.assigned_to !== undefined) {
          addUpdate('assigned_to', 'assigned_to', request.assigned_to);
        }

        if (request.metadata !== undefined) {
          addUpdate('metadata', 'metadata', request.metadata, (v) =>
            JSON.stringify(v)
          );
        }

        // No fields to update
        if (updates.length === 0) {
          logger.debug({ leadId }, 'No fields changed, returning current lead');
          return {
            lead: current,
            changedFields: [],
            previousValues: {},
            newValues: {},
          };
        }

        // Execute UPDATE query
        const updateQuery = `
          UPDATE leads
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        params.push(leadId);

        const updateResult = await client.query<Lead>(updateQuery, params);
        const updatedLead = updateResult.rows[0];

        // Create activity log entry
        const activityLogQuery = `
          INSERT INTO activity_logs (
            id,
            lead_id,
            user_id,
            action,
            description,
            metadata,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
          )
        `;

        await client.query(activityLogQuery, [
          uuidv4(),
          leadId,
          updatedBy,
          ActivityAction.UPDATE,
          `Lead "${updatedLead.name}" updated: ${changedFields.join(', ')}`,
          JSON.stringify({
            changedFields,
            previousValues,
            newValues,
          }),
        ]);

        logger.info(
          {
            leadId: updatedLead.id,
            changedFields,
          },
          'Lead updated successfully in database'
        );

        return {
          lead: updatedLead,
          changedFields,
          previousValues,
          newValues,
        };
      });

    // Invalidate cache (outside transaction, best effort)
    try {
      await invalidateLeadCaches(leadId);
    } catch (cacheError) {
      logger.warn(
        {
          error: cacheError,
          leadId,
        },
        'Failed to invalidate cache (non-fatal)'
      );
    }

    // Publish lead.updated event (outside transaction, best effort)
    if (changedFields.length > 0) {
      try {
        await publishLeadUpdated({
          leadId: lead.id,
          updatedBy,
          changedFields,
          previousValues,
          newValues,
        });

        logger.info(
          {
            leadId: lead.id,
            changedFields,
          },
          'Lead updated event published'
        );
      } catch (eventError) {
        logger.error(
          {
            error: eventError,
            leadId: lead.id,
          },
          'Failed to publish lead.updated event (non-fatal)'
        );
      }
    }

    return lead;
  } catch (error) {
    // If it's a ConflictError or NotFoundError, rethrow it
    if (error instanceof ConflictError || error instanceof NotFoundError) {
      throw error;
    }

    logger.error(
      {
        error,
        leadId,
        updatedBy,
      },
      'Failed to update lead'
    );

    throw error;
  }
}

/**
 * Create lead score and update lead qualification status
 *
 * @param leadId - Lead UUID
 * @param scores - BANT scores from AI qualification
 * @param qualifiedBy - User ID who triggered qualification
 * @returns Created lead score
 */
export async function createLeadScore(
  leadId: string,
  scores: {
    budget_score: number;
    authority_score: number;
    need_score: number;
    timeline_score: number;
    reasoning: string;
    confidence: number;
  },
  qualifiedBy: string
): Promise<import('../models/LeadScore').LeadScore> {
  const { determineQualificationStatus } = await import('../models/Lead');
  const { publishLeadQualified } = await import('./DaprPubSubService');
  const { invalidateLeadCaches } = await import('./DaprStateService');
  const { ActivityAction } = await import('../models/ActivityLog');

  const scoreId = uuidv4();
  const totalScore =
    scores.budget_score +
    scores.authority_score +
    scores.need_score +
    scores.timeline_score;

  try {
    logger.info(
      {
        leadId,
        scoreId,
        totalScore,
        qualifiedBy,
      },
      'Creating lead score'
    );

    // Execute in transaction to ensure atomicity
    const { leadScore, lead, previousQualificationStatus } =
      await executeTransaction(async (client) => {
        // Get current lead
        const leadQuery = 'SELECT * FROM leads WHERE id = $1';
        const leadResult = await client.query<Lead>(leadQuery, [leadId]);

        if (leadResult.rows.length === 0) {
          throw new NotFoundError(`Lead with ID "${leadId}" not found`);
        }

        const currentLead = leadResult.rows[0];
        const previousQualStatus = currentLead.qualification_status;

        // Insert lead score
        const insertScoreQuery = `
          INSERT INTO lead_scores (
            id,
            lead_id,
            budget_score,
            authority_score,
            need_score,
            timeline_score,
            reasoning,
            confidence,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
          )
          RETURNING *
        `;

        const scoreResult = await client.query(insertScoreQuery, [
          scoreId,
          leadId,
          scores.budget_score,
          scores.authority_score,
          scores.need_score,
          scores.timeline_score,
          scores.reasoning,
          scores.confidence,
        ]);

        const newScore = scoreResult.rows[0];

        // Determine new qualification status based on total score
        const newQualificationStatus = determineQualificationStatus(totalScore);

        // Update lead qualification status
        const updateLeadQuery = `
          UPDATE leads
          SET qualification_status = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `;

        const leadUpdateResult = await client.query<Lead>(updateLeadQuery, [
          newQualificationStatus,
          leadId,
        ]);

        const updatedLead = leadUpdateResult.rows[0];

        // Create activity log entry
        const activityLogQuery = `
          INSERT INTO activity_logs (
            id,
            lead_id,
            user_id,
            action,
            description,
            metadata,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
          )
        `;

        await client.query(activityLogQuery, [
          uuidv4(),
          leadId,
          qualifiedBy,
          ActivityAction.QUALIFY,
          `Lead "${updatedLead.name}" qualified with total score ${totalScore}`,
          JSON.stringify({
            scoreId: newScore.id,
            totalScore,
            budgetScore: scores.budget_score,
            authorityScore: scores.authority_score,
            needScore: scores.need_score,
            timelineScore: scores.timeline_score,
            qualificationStatus: newQualificationStatus,
            previousQualificationStatus: previousQualStatus,
            confidence: scores.confidence,
          }),
        ]);

        logger.info(
          {
            leadId,
            scoreId: newScore.id,
            totalScore,
            qualificationStatus: newQualificationStatus,
          },
          'Lead score created successfully in database'
        );

        return {
          leadScore: newScore,
          lead: updatedLead,
          previousQualificationStatus: previousQualStatus,
        };
      });

    // Invalidate cache (outside transaction, best effort)
    try {
      await invalidateLeadCaches(leadId);
    } catch (cacheError) {
      logger.warn(
        {
          error: cacheError,
          leadId,
        },
        'Failed to invalidate cache (non-fatal)'
      );
    }

    // Publish lead.qualified event if status changed to qualified (outside transaction, best effort)
    if (lead.qualification_status === QualificationStatus.QUALIFIED) {
      try {
        await publishLeadQualified({
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: lead.email,
          totalScore,
          qualificationStatus: lead.qualification_status,
          assignedTo: lead.assigned_to,
        });

        logger.info(
          {
            leadId: lead.id,
            totalScore,
          },
          'Lead qualified event published'
        );
      } catch (eventError) {
        logger.error(
          {
            error: eventError,
            leadId: lead.id,
          },
          'Failed to publish lead.qualified event (non-fatal)'
        );
      }
    }

    return leadScore;
  } catch (error) {
    // If it's a NotFoundError, rethrow it
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error(
      {
        error,
        leadId,
        qualifiedBy,
      },
      'Failed to create lead score'
    );

    throw error;
  }
}

/**
 * Get latest lead score for a lead
 *
 * @param leadId - Lead UUID
 * @returns Latest lead score or null if not qualified yet
 */
export async function getLatestLeadScore(
  leadId: string
): Promise<import('../models/LeadScore').LeadScore | null> {
  const query = `
    SELECT *
    FROM lead_scores
    WHERE lead_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;

  try {
    const score = await executeQueryOne<import('../models/LeadScore').LeadScore>(
      query,
      [leadId]
    );

    if (!score) {
      logger.debug({ leadId }, 'No lead score found');
      return null;
    }

    logger.debug({ leadId, scoreId: score.id }, 'Latest lead score retrieved');
    return score;
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to get latest lead score');
    throw error;
  }
}

/**
 * Get all lead scores for a lead (historical)
 *
 * @param leadId - Lead UUID
 * @returns Array of lead scores ordered by created_at DESC
 */
export async function getAllLeadScores(
  leadId: string
): Promise<import('../models/LeadScore').LeadScore[]> {
  const query = `
    SELECT *
    FROM lead_scores
    WHERE lead_id = $1
    ORDER BY created_at DESC
  `;

  try {
    const scores = await executeQueryAll<import('../models/LeadScore').LeadScore>(
      query,
      [leadId]
    );

    logger.debug(
      { leadId, scoresCount: scores.length },
      'All lead scores retrieved'
    );
    return scores;
  } catch (error) {
    logger.error({ error, leadId }, 'Failed to get all lead scores');
    throw error;
  }
}

/**
 * Delete a lead and all associated data
 *
 * This function performs a hard delete of the lead and all related records.
 * Due to CASCADE DELETE foreign key constraints, related records in lead_scores,
 * activity_logs, and other tables are automatically deleted.
 *
 * @param leadId - UUID of the lead to delete
 * @param deletedBy - User ID who is deleting the lead
 * @param options - Optional deletion metadata
 * @returns void
 */
export async function deleteLead(
  leadId: string,
  deletedBy: string,
  options?: {
    reason?: string;
    gdprRequest?: boolean;
  }
): Promise<void> {
  try {
    logger.info(
      {
        leadId,
        deletedBy,
        reason: options?.reason,
        gdprRequest: options?.gdprRequest || false,
      },
      'Deleting lead'
    );

    // Execute deletion in a transaction
    await executeTransaction(async (client) => {
      // Get lead details before deletion (for event publishing and logging)
      const leadResult = await client.query<Lead>(
        'SELECT id, name, email, company, status, qualification_status FROM leads WHERE id = $1',
        [leadId]
      );

      if (leadResult.rows.length === 0) {
        throw new NotFoundError(`Lead with ID "${leadId}" not found`);
      }

      const lead = leadResult.rows[0];

      // Create activity log for deletion
      await client.query(
        `INSERT INTO activity_logs (
          id, lead_id, user_id, action, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          uuidv4(),
          leadId,
          deletedBy,
          ActivityAction.DELETE,
          JSON.stringify({
            leadName: lead.name,
            leadEmail: lead.email,
            leadCompany: lead.company,
            leadStatus: lead.status,
            leadQualificationStatus: lead.qualification_status,
            reason: options?.reason,
            gdprRequest: options?.gdprRequest || false,
          }),
        ]
      );

      // Delete the lead (CASCADE will handle related records)
      const deleteResult = await client.query(
        'DELETE FROM leads WHERE id = $1',
        [leadId]
      );

      if (deleteResult.rowCount === 0) {
        throw new NotFoundError(`Lead with ID "${leadId}" not found`);
      }

      logger.info(
        {
          leadId,
          leadEmail: lead.email,
          deletedBy,
        },
        'Lead deleted successfully'
      );

      // Publish lead.deleted event (after transaction commits)
      await publishLeadDeleted({
        leadId,
        leadEmail: lead.email,
        deletedBy,
        reason: options?.reason,
        gdprRequest: options?.gdprRequest || false,
      });
    });

    // Invalidate caches for this lead
    await invalidateLeadCaches(leadId);

    logger.info(
      {
        leadId,
        deletedBy,
      },
      'Lead deletion completed with cache invalidation'
    );
  } catch (error) {
    logger.error(
      {
        error,
        leadId,
        deletedBy,
      },
      'Failed to delete lead'
    );
    throw error;
  }
}
