/**
 * Qualify Lead Handler
 *
 * Handles POST /api/v1/leads/:id/qualify endpoint for AI-powered lead qualification.
 * Triggers Claude API BANT analysis and creates lead score record.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, getAuthenticatedUser } from '../middleware/auth';
import { getLeadByIdOrFail, createLeadScore } from '../../services/LeadService';
import { qualifyLeadWithAI } from '../../services/AIQualificationService';
import { logger } from '../../lib/logger';
import { asyncErrorHandler, NotFoundError } from '../middleware/errorHandler';
import { toBANTBreakdown } from '../../models/LeadScore';
import { canModifyLead } from '../../models/User';

/**
 * Qualify lead with AI handler
 *
 * POST /api/v1/leads/:id/qualify
 *
 * Response: 200 OK
 * {
 *   "leadId": "uuid",
 *   "leadName": "John Doe",
 *   "qualificationStatus": "qualified",
 *   "score": {
 *     "budget_score": 20,
 *     "authority_score": 22,
 *     "need_score": 18,
 *     "timeline_score": 24,
 *     "total_score": 84,
 *     "reasoning": "...",
 *     "confidence": 0.85,
 *     "created_at": "2025-12-31T..."
 *   },
 *   "breakdown": {
 *     "budget": { "score": 20, "percentage": 80, "label": "Very High" },
 *     "authority": { "score": 22, "percentage": 88, "label": "Very High" },
 *     "need": { "score": 18, "percentage": 72, "label": "High" },
 *     "timeline": { "score": 24, "percentage": 96, "label": "Very High" },
 *     "total": { "score": 84, "percentage": 84, "label": "Qualified" }
 *   }
 * }
 *
 * Error responses:
 * - 400 Bad Request: Invalid lead ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Lead not found
 * - 500 Internal Server Error: AI API error or server error
 * - 502 Bad Gateway: Claude API unavailable
 */
export const handleQualifyLead = asyncErrorHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = getAuthenticatedUser(authReq);
    const leadId = req.params['id'] as string;

    logger.info(
      {
        userId: user.userId,
        leadId,
      },
      'Lead qualification request received'
    );

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadId)) {
      logger.warn(
        {
          leadId: leadId || 'missing',
          userId: user.userId,
        },
        'Invalid lead ID format'
      );

      res.status(400).json({
        error: {
          code: 'INVALID_LEAD_ID',
          message: 'Invalid lead ID format. Must be a valid UUID.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get lead or throw 404
    const lead = await getLeadByIdOrFail(leadId);

    logger.info(
      {
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        currentQualificationStatus: lead.qualification_status,
        userId: user.userId,
      },
      'Lead retrieved, checking permissions'
    );

    // RBAC check: Can user qualify (modify) this lead?
    if (!canModifyLead(user, lead.assigned_to)) {
      logger.warn(
        {
          userId: user.userId,
          userRole: user.role,
          leadId: lead.id,
          leadAssignedTo: lead.assigned_to,
        },
        'Access denied: user cannot qualify this lead'
      );

      throw new NotFoundError(`Lead with ID "${leadId}" not found`);
    }

    logger.info(
      {
        leadId: lead.id,
        userId: user.userId,
      },
      'Permission granted, starting AI qualification'
    );

    // Qualify lead with AI
    let qualificationResult;
    try {
      qualificationResult = await qualifyLeadWithAI(lead);
    } catch (aiError) {
      logger.error(
        {
          error: aiError,
          leadId: lead.id,
          errorMessage:
            aiError instanceof Error ? aiError.message : 'Unknown error',
        },
        'AI qualification failed'
      );

      // Check if it's a Claude API error (network, rate limit, etc.)
      if (
        aiError instanceof Error &&
        (aiError.message.includes('API') ||
          aiError.message.includes('network') ||
          aiError.message.includes('timeout'))
      ) {
        res.status(502).json({
          error: {
            code: 'AI_SERVICE_UNAVAILABLE',
            message:
              'AI qualification service is temporarily unavailable. Please try again later.',
            details: aiError.message,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Generic server error
      throw aiError;
    }

    logger.info(
      {
        leadId: lead.id,
        totalScore: qualificationResult.total_score,
        confidence: qualificationResult.confidence,
      },
      'AI qualification completed, saving scores'
    );

    // Create lead score record and update lead qualification status
    const leadScore = await createLeadScore(
      lead.id,
      {
        budget_score: qualificationResult.budget_score,
        authority_score: qualificationResult.authority_score,
        need_score: qualificationResult.need_score,
        timeline_score: qualificationResult.timeline_score,
        reasoning: qualificationResult.reasoning,
        confidence: qualificationResult.confidence,
      },
      user.userId
    );

    // Get BANT breakdown for response
    const breakdown = toBANTBreakdown(leadScore);

    // Refresh lead to get updated qualification status
    const updatedLead = await getLeadByIdOrFail(leadId);

    logger.info(
      {
        leadId: updatedLead.id,
        scoreId: leadScore.id,
        totalScore: leadScore.total_score,
        qualificationStatus: updatedLead.qualification_status,
        userId: user.userId,
      },
      'Lead qualification completed successfully'
    );

    // Return qualification result
    res.status(200).json({
      leadId: updatedLead.id,
      leadName: updatedLead.name,
      qualificationStatus: updatedLead.qualification_status,
      score: {
        id: leadScore.id,
        budget_score: leadScore.budget_score,
        authority_score: leadScore.authority_score,
        need_score: leadScore.need_score,
        timeline_score: leadScore.timeline_score,
        total_score: leadScore.total_score,
        reasoning: leadScore.reasoning,
        confidence: leadScore.confidence,
        created_at: leadScore.created_at,
      },
      breakdown,
    });
  }
);
