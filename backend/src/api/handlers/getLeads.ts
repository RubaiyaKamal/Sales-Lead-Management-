/**
 * Get Leads Handlers
 *
 * Handles GET /api/v1/leads (list) and GET /api/v1/leads/:id (detail) endpoints.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, getAuthenticatedUser } from '../middleware/auth';
import { listLeads, getLeadWithScoreById } from '../../services/LeadService';
import { validateLeadListQuery, validateUUID } from '../../lib/validator';
import { logger } from '../../lib/logger';
import { asyncErrorHandler } from '../middleware/errorHandler';
import { NotFoundError } from '../middleware/errorHandler';

/**
 * List leads handler
 *
 * GET /api/v1/leads
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: LeadStatus (optional)
 * - qualification_status: QualificationStatus (optional)
 * - lead_source: LeadSource (optional)
 * - assigned_to: UUID (optional)
 * - search: string (optional) - searches name, email, company
 * - sortBy: 'created_at' | 'updated_at' | 'name' | 'company' (default: 'created_at')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 *
 * Response: 200 OK
 * {
 *   "data": [...leads with scores...],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 100,
 *     "totalPages": 5
 *   },
 *   "meta": {
 *     "filters": {...applied filters...}
 *   }
 * }
 *
 * RBAC:
 * - Sales Rep: Only sees assigned leads
 * - Manager: Sees all leads (team filtering TBD)
 * - Admin: Sees all leads
 */
export const handleGetLeads = asyncErrorHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = getAuthenticatedUser(authReq);

    logger.info(
      {
        userId: user.userId,
        userRole: user.role,
        query: req.query,
      },
      'Get leads request received'
    );

    // Validate query parameters
    const validatedQuery = validateLeadListQuery(req.query);

    logger.debug(
      {
        userId: user.userId,
        validatedQuery,
      },
      'Get leads query validated'
    );

    // List leads with RBAC filtering
    const result = await listLeads(validatedQuery, {
      userId: user.userId,
      role: user.role,
    });

    logger.info(
      {
        userId: user.userId,
        resultsCount: result.data.length,
        total: result.pagination.total,
        page: result.pagination.page,
      },
      'Leads listed successfully'
    );

    // Return lead list
    res.status(200).json(result);
  }
);

/**
 * Get lead by ID handler
 *
 * GET /api/v1/leads/:id
 *
 * Response: 200 OK
 * {
 *   "id": "uuid",
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   ...
 *   "lead_score": {
 *     "budget_score": 20,
 *     "authority_score": 22,
 *     "need_score": 15,
 *     "timeline_score": 24,
 *     "total_score": 81,
 *     "reasoning": "...",
 *     ...
 *   }
 * }
 *
 * Error responses:
 * - 400 Bad Request: Invalid UUID
 * - 401 Unauthorized: Missing or invalid authentication
 * - 403 Forbidden: User cannot access this lead
 * - 404 Not Found: Lead not found
 */
export const handleGetLead = asyncErrorHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = getAuthenticatedUser(authReq);

    // Validate lead ID
    const leadIdParam = req.params['id'];
    if (!leadIdParam) {
      throw new Error('Lead ID parameter is required');
    }
    const leadId = validateUUID(leadIdParam, 'Lead ID');

    logger.info(
      {
        userId: user.userId,
        leadId,
      },
      'Get lead request received'
    );

    // Get lead with score
    const lead = await getLeadWithScoreById(leadId);

    if (!lead) {
      throw new NotFoundError(`Lead with ID "${leadId}" not found`);
    }

    // RBAC check: Can user access this lead?
    // Sales reps can only access assigned leads
    // Managers and admins can access all leads
    if (
      user.role === 'sales_rep' &&
      lead.assigned_to !== user.userId
    ) {
      logger.warn(
        {
          userId: user.userId,
          leadId,
          leadAssignedTo: lead.assigned_to,
        },
        'Access denied: user cannot access this lead'
      );

      throw new NotFoundError(`Lead with ID "${leadId}" not found`);
    }

    logger.info(
      {
        userId: user.userId,
        leadId,
        leadEmail: lead.email,
      },
      'Lead retrieved successfully'
    );

    // Return lead
    res.status(200).json(lead);
  }
);
