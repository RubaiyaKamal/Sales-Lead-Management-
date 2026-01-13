/**
 * Update Lead Handler
 *
 * Handles PATCH /api/v1/leads/:id endpoint for updating lead information.
 * Supports partial updates with optimistic locking.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, getAuthenticatedUser } from '../middleware/auth';
import { updateLead, getLeadByIdOrFail } from '../../services/LeadService';
import { validateUpdateLead, validateUUID } from '../../lib/validator';
import { logger } from '../../lib/logger';
import { asyncErrorHandler, NotFoundError } from '../middleware/errorHandler';
import { canModifyLead } from '../../models/User';

/**
 * Update lead handler
 *
 * PATCH /api/v1/leads/:id
 *
 * Request body (all fields optional):
 * {
 *   "name": "Jane Doe",
 *   "email": "jane@example.com",
 *   "phone": "+12025551234",
 *   "company": "Updated Corp",
 *   "status": "contacted",
 *   "assignedTo": "uuid",
 *   "metadata": {},
 *   "previousUpdatedAt": "2025-01-15T10:30:00.000Z"  // Optional: for optimistic locking
 * }
 *
 * Response: 200 OK
 * {
 *   "id": "uuid",
 *   "name": "Jane Doe",
 *   "email": "jane@example.com",
 *   ...
 * }
 *
 * Error responses:
 * - 400 Bad Request: Validation errors or invalid UUID
 * - 401 Unauthorized: Missing or invalid authentication
 * - 403 Forbidden: User cannot modify this lead (RBAC)
 * - 404 Not Found: Lead not found
 * - 409 Conflict: Concurrent update detected (optimistic locking) or duplicate email
 * - 500 Internal Server Error: Server error
 *
 * RBAC:
 * - Sales Rep: Can only update assigned leads
 * - Manager: Can update all leads (team filtering TBD)
 * - Admin: Can update all leads
 */
export const handleUpdateLead = asyncErrorHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = getAuthenticatedUser(authReq);

    // Validate lead ID
    const leadId = validateUUID(req.params['id'] as string, 'Lead ID');

    logger.info(
      {
        userId: user.userId,
        userRole: user.role,
        leadId,
        updateFields: Object.keys(req.body),
      },
      'Update lead request received'
    );

    // Check if lead exists and get current state for RBAC check
    const existingLead = await getLeadByIdOrFail(leadId);

    // RBAC check: Can user modify this lead?
    if (!canModifyLead(user, existingLead.assigned_to)) {
      logger.warn(
        {
          userId: user.userId,
          userRole: user.role,
          leadId,
          leadAssignedTo: existingLead.assigned_to,
        },
        'Access denied: user cannot modify this lead'
      );

      throw new NotFoundError(`Lead with ID "${leadId}" not found`);
    }

    // Validate request body
    const validatedRequest = validateUpdateLead(req.body);

    logger.debug(
      {
        userId: user.userId,
        leadId,
        validatedFields: Object.keys(validatedRequest),
      },
      'Update lead request validated'
    );

    // Extract previous_updated_at for optimistic locking
    // Check If-Unmodified-Since header (standard) or request body
    const headerValue = req.header('if-unmodified-since');
    const bodyValue = validatedRequest.previous_updated_at;
    const previousUpdatedAtRaw = headerValue || bodyValue;

    const previousUpdatedAt = previousUpdatedAtRaw
      ? new Date(previousUpdatedAtRaw)
      : undefined;

    // Update lead
    const updatedLead = await updateLead(
      leadId,
      validatedRequest,
      user.userId,
      previousUpdatedAt
    );

    logger.info(
      {
        leadId: updatedLead.id,
        leadEmail: updatedLead.email,
        userId: user.userId,
        updatedAt: updatedLead.updated_at,
      },
      'Lead updated successfully'
    );

    // Return updated lead
    res.status(200).json(updatedLead);
  }
);
