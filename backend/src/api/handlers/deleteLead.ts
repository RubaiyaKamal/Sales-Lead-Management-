/**
 * Delete Lead Handler
 *
 * Handles DELETE /api/v1/leads/:id endpoint for deleting leads.
 * Restricted to admin users only for data integrity and GDPR compliance.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, getAuthenticatedUser } from '../middleware/auth';
import { deleteLead, getLeadByIdOrFail } from '../../services/LeadService';
import { validateUUID } from '../../lib/validator';
import { logger } from '../../lib/logger';
import {
  asyncErrorHandler,
  AuthorizationError,
  NotFoundError,
} from '../middleware/errorHandler';
import { canDeleteLead } from '../../models/User';

/**
 * Delete lead handler
 *
 * DELETE /api/v1/leads/:id
 *
 * Query parameters (optional):
 * - reason: Reason for deletion (e.g., "Duplicate", "Spam", "GDPR request")
 * - gdprRequest: Set to "true" if this is a GDPR data deletion request
 *
 * Response: 204 No Content
 *
 * Error responses:
 * - 400 Bad Request: Invalid UUID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 403 Forbidden: User does not have permission to delete leads (non-admin)
 * - 404 Not Found: Lead not found
 * - 500 Internal Server Error: Server error
 *
 * RBAC:
 * - Admin: Can delete any lead
 * - Manager: Cannot delete leads
 * - Sales Rep: Cannot delete leads
 *
 * Cascade deletion:
 * - All related records (lead_scores, activity_logs) are automatically deleted
 *   via ON DELETE CASCADE foreign key constraints
 * - Activity log for deletion is created before the lead is removed
 * - Cache entries are invalidated
 * - lead.deleted event is published to Kafka
 */
export const handleDeleteLead = asyncErrorHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = getAuthenticatedUser(authReq);

    // Validate lead ID
    const leadId = validateUUID(req.params.id, 'Lead ID');

    // Extract optional parameters
    const reason = req.query.reason as string | undefined;
    const gdprRequest = req.query.gdprRequest === 'true';

    logger.info(
      {
        leadId,
        userId: user.userId,
        role: user.role,
        reason,
        gdprRequest,
      },
      'Delete lead request received'
    );

    // Check authorization - only admins can delete leads
    if (!canDeleteLead(user)) {
      logger.warn(
        {
          leadId,
          userId: user.userId,
          role: user.role,
        },
        'Unauthorized delete attempt - user is not admin'
      );

      throw new AuthorizationError(
        'Only administrators can delete leads. Please contact your system administrator if you need to remove this lead.'
      );
    }

    // Verify lead exists before attempting deletion
    // This provides better error messages and logging
    await getLeadByIdOrFail(leadId);

    logger.info(
      {
        leadId,
        userId: user.userId,
        reason,
        gdprRequest,
      },
      'Lead found, proceeding with deletion'
    );

    // Delete the lead
    await deleteLead(leadId, user.userId, {
      reason,
      gdprRequest,
    });

    logger.info(
      {
        leadId,
        userId: user.userId,
        reason,
        gdprRequest,
      },
      'Lead deleted successfully'
    );

    // Return 204 No Content (successful deletion with no response body)
    res.status(204).send();
  }
);
