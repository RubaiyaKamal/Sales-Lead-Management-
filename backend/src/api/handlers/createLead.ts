/**
 * Create Lead Handler
 *
 * Handles POST /api/v1/leads endpoint for creating new leads.
 * Validates input, creates lead, and returns created lead object.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, getAuthenticatedUser } from '../middleware/auth';
import { createLead } from '../../services/LeadService';
import { validateCreateLead } from '../../lib/validator';
import { logger } from '../../lib/logger';
import { asyncErrorHandler } from '../middleware/errorHandler';

/**
 * Create new lead handler
 *
 * POST /api/v1/leads
 *
 * Request body:
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "phone": "+12025551234",
 *   "company": "Acme Corp",
 *   "leadSource": "website",
 *   "metadata": {}
 * }
 *
 * Response: 201 Created
 * {
 *   "id": "uuid",
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   ...
 * }
 *
 * Error responses:
 * - 400 Bad Request: Validation errors
 * - 401 Unauthorized: Missing or invalid authentication
 * - 409 Conflict: Duplicate email
 * - 429 Too Many Requests: Rate limit exceeded
 * - 500 Internal Server Error: Server error
 */
export const handleCreateLead = asyncErrorHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = getAuthenticatedUser(authReq);

    logger.info(
      {
        userId: user.userId,
        email: req.body?.email,
      },
      'Create lead request received'
    );

    // Validate request body
    const validatedRequest = validateCreateLead(req.body);

    logger.debug(
      {
        userId: user.userId,
        leadEmail: validatedRequest.email,
      },
      'Create lead request validated'
    );

    // Create lead
    const lead = await createLead(validatedRequest, user.userId);

    logger.info(
      {
        leadId: lead.id,
        leadEmail: lead.email,
        userId: user.userId,
      },
      'Lead created successfully'
    );

    // Return created lead
    res.status(201).json(lead);
  }
);
