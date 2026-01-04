/**
 * API Routes Configuration
 *
 * Defines all API endpoints and their handlers.
 * Structure: /api/v1/leads
 */

import { Router } from 'express';
import {
  handleHealthCheck,
  handleLivenessProbe,
  handleReadinessProbe,
} from './handlers/health';
import { handleCreateLead } from './handlers/createLead';
import { handleGetLeads, handleGetLead } from './handlers/getLeads';
import { handleUpdateLead } from './handlers/updateLead';
import { handleDeleteLead } from './handlers/deleteLead';
import { handleQualifyLead } from './handlers/qualifyLead';
import { authenticate } from './middleware/auth';
import { globalRateLimiter, strictRateLimiter } from './middleware/rateLimiter';
import { config } from '../lib/config';

/**
 * Create and configure API router
 */
export function createRouter(): Router {
  const router = Router();

  // ================================================================
  // Health Check Routes (no authentication required)
  // ================================================================

  /**
   * GET /health
   * Detailed health check with all dependency statuses
   */
  router.get('/health', handleHealthCheck);

  /**
   * GET /health/live
   * Kubernetes liveness probe (is the service alive?)
   */
  router.get('/health/live', handleLivenessProbe);

  /**
   * GET /health/ready
   * Kubernetes readiness probe (is the service ready?)
   */
  router.get('/health/ready', handleReadinessProbe);

  // ================================================================
  // API v1 Routes
  // ================================================================

  const apiRouter = Router();

  // Apply global rate limiting to all API routes
  if (config.features.rateLimiting) {
    apiRouter.use(globalRateLimiter);
  }

  // ================================================================
  // Lead Routes
  // ================================================================

  /**
   * POST /api/v1/leads
   * Create new lead (User Story 1)
   * Requires authentication
   * Rate limited (strict)
   */
  apiRouter.post('/leads', authenticate, strictRateLimiter, handleCreateLead);

  /**
   * GET /api/v1/leads
   * List leads with filtering, pagination, and search (User Story 2)
   * Requires authentication
   * RBAC: Sales reps see assigned leads, managers/admins see all
   */
  apiRouter.get('/leads', authenticate, handleGetLeads);

  /**
   * GET /api/v1/leads/:id
   * Get lead by ID with latest score (User Story 2)
   * Requires authentication
   * RBAC: Sales reps can only access assigned leads
   */
  apiRouter.get('/leads/:id', authenticate, handleGetLead);

  /**
   * PATCH /api/v1/leads/:id
   * Update lead information (User Story 3)
   * Requires authentication
   * RBAC: Sales reps can only update assigned leads
   * Supports partial updates with optimistic locking
   */
  apiRouter.patch('/leads/:id', authenticate, handleUpdateLead);

  /**
   * DELETE /api/v1/leads/:id
   * Delete lead (User Story 5)
   * Requires authentication
   * RBAC: Only admins can delete leads
   * Supports cascade deletion and GDPR compliance
   */
  apiRouter.delete('/leads/:id', authenticate, handleDeleteLead);

  /**
   * POST /api/v1/leads/:id/qualify
   * AI-powered lead qualification (User Story 4)
   * Requires authentication
   * Triggers Claude API BANT analysis and creates lead score
   */
  apiRouter.post('/leads/:id/qualify', authenticate, handleQualifyLead);

  // Mount API v1 router
  router.use(`/api/${config.apiVersion}`, apiRouter);

  return router;
}

/**
 * Get API base path
 */
export function getApiBasePath(): string {
  return `/api/${config.apiVersion}`;
}

/**
 * Get full API URL for a path
 */
export function getApiUrl(path: string): string {
  const basePath = getApiBasePath();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}
