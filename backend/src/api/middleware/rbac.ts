/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Enforces role-based permissions for API endpoints.
 * Roles: admin, manager, sales_rep
 *
 * Permission model:
 * - admin: Full access to all resources
 * - manager: Access to team resources and lead assignment
 * - sales_rep: Access to assigned resources only
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, getAuthenticatedUser } from './auth';
import { AuthorizationError } from './errorHandler';
import { UserRole, isAdmin, isManager } from '../../models/User';
import { logger } from '../../lib/logger';

/**
 * Require specific role(s) to access endpoint
 *
 * Usage:
 * app.delete('/api/v1/leads/:id', authenticate, requireRole(['admin']), deleteLead);
 * app.get('/api/v1/leads', authenticate, requireRole(['admin', 'manager', 'sales_rep']), getLeads);
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const user = getAuthenticatedUser(req);

      if (!allowedRoles.includes(user.role)) {
        logger.warn(
          {
            userId: user.userId,
            userRole: user.role,
            allowedRoles,
            path: req.path,
            method: req.method,
          },
          'Access denied: insufficient permissions'
        );

        throw new AuthorizationError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      logger.debug(
        {
          userId: user.userId,
          role: user.role,
          path: req.path,
        },
        'Role check passed'
      );

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require admin role
 * Shorthand for requireRole(['admin'])
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  return requireRole([UserRole.ADMIN])(req, _res, next);
}

/**
 * Require admin or manager role
 * Shorthand for requireRole(['admin', 'manager'])
 */
export function requireManagerOrAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  return requireRole([UserRole.ADMIN, UserRole.MANAGER])(req, _res, next);
}

/**
 * Check if user can access a specific lead
 * - Admin: Access all leads
 * - Manager: Access all leads (simplified - team filtering TBD)
 * - Sales Rep: Access assigned leads only
 *
 * This should be called within route handlers, not as middleware
 */
export function canAccessLead(
  req: AuthenticatedRequest,
  leadAssignedTo: string | null
): boolean {
  const user = getAuthenticatedUser(req);

  // Admin can access all leads
  if (isAdmin(user)) {
    return true;
  }

  // Manager can access all leads (simplified - team filtering TBD)
  if (isManager(user)) {
    return true;
  }

  // Sales rep can only access leads assigned to them
  return leadAssignedTo === user.userId;
}

/**
 * Check if user can modify a specific lead
 * - Admin: Modify all leads
 * - Manager: Modify all leads (simplified - team filtering TBD)
 * - Sales Rep: Modify assigned leads only
 *
 * This should be called within route handlers, not as middleware
 */
export function canModifyLead(
  req: AuthenticatedRequest,
  leadAssignedTo: string | null
): boolean {
  return canAccessLead(req, leadAssignedTo);
}

/**
 * Check if user can delete leads
 * - Only admin can delete leads
 *
 * This should be called within route handlers, not as middleware
 */
export function canDeleteLead(req: AuthenticatedRequest): boolean {
  const user = getAuthenticatedUser(req);
  return isAdmin(user);
}

/**
 * Middleware to enforce lead access control
 * Expects lead to be loaded into req.lead by a previous middleware
 *
 * Usage:
 * app.get('/api/v1/leads/:id', authenticate, loadLead, enforceLeadAccess, getLead);
 */
export function enforceLeadAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authReq = req as AuthenticatedRequest & {
      lead: { assigned_to: string | null };
    };

    if (!authReq.lead) {
      throw new Error(
        'Lead not loaded. Use loadLead middleware before enforceLeadAccess.'
      );
    }

    if (!canAccessLead(authReq, authReq.lead.assigned_to)) {
      const user = getAuthenticatedUser(authReq);

      logger.warn(
        {
          userId: user.userId,
          userRole: user.role,
          leadAssignedTo: authReq.lead.assigned_to,
          path: req.path,
        },
        'Access denied: user cannot access this lead'
      );

      throw new AuthorizationError(
        'You do not have permission to access this lead'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to enforce lead modification access control
 * Expects lead to be loaded into req.lead by a previous middleware
 *
 * Usage:
 * app.patch('/api/v1/leads/:id', authenticate, loadLead, enforceLeadModify, updateLead);
 */
export function enforceLeadModify(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authReq = req as AuthenticatedRequest & {
      lead: { assigned_to: string | null };
    };

    if (!authReq.lead) {
      throw new Error(
        'Lead not loaded. Use loadLead middleware before enforceLeadModify.'
      );
    }

    if (!canModifyLead(authReq, authReq.lead.assigned_to)) {
      const user = getAuthenticatedUser(authReq);

      logger.warn(
        {
          userId: user.userId,
          userRole: user.role,
          leadAssignedTo: authReq.lead.assigned_to,
          path: req.path,
        },
        'Access denied: user cannot modify this lead'
      );

      throw new AuthorizationError(
        'You do not have permission to modify this lead'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to filter leads query based on user role
 * Returns SQL WHERE clause conditions and parameters
 *
 * Usage in service layer:
 * const { conditions, params } = getLeadFilterForUser(user);
 * const query = `SELECT * FROM leads WHERE ${conditions.join(' AND ')}`;
 */
export function getLeadFilterForUser(user: {
  userId: string;
  role: UserRole;
}): {
  conditions: string[];
  params: any[];
} {
  const conditions: string[] = [];
  const params: any[] = [];

  // Admin and Manager can see all leads
  if (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) {
    return { conditions: [], params: [] };
  }

  // Sales rep can only see assigned leads
  if (user.role === UserRole.SALES_REP) {
    conditions.push('assigned_to = $1');
    params.push(user.userId);
  }

  return { conditions, params };
}

/**
 * Check if user can assign leads to other users
 * - Admin: Can assign any lead to any user
 * - Manager: Can assign any lead to any user (simplified)
 * - Sales Rep: Cannot assign leads
 */
export function canAssignLeads(req: AuthenticatedRequest): boolean {
  const user = getAuthenticatedUser(req);
  return isAdmin(user) || isManager(user);
}

/**
 * Middleware to enforce lead assignment permissions
 *
 * Usage:
 * app.patch('/api/v1/leads/:id/assign', authenticate, requireLeadAssignment, assignLead);
 */
export function requireLeadAssignment(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!canAssignLeads(authReq)) {
      const user = getAuthenticatedUser(authReq);

      logger.warn(
        {
          userId: user.userId,
          userRole: user.role,
          path: req.path,
        },
        'Access denied: user cannot assign leads'
      );

      throw new AuthorizationError(
        'You do not have permission to assign leads. Only managers and admins can assign leads.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user can qualify leads
 * - Admin: Can qualify any lead
 * - Manager: Can qualify any lead
 * - Sales Rep: Can qualify assigned leads only
 */
export function canQualifyLead(
  req: AuthenticatedRequest,
  leadAssignedTo: string | null
): boolean {
  const user = getAuthenticatedUser(req);

  // Admin and Manager can qualify any lead
  if (isAdmin(user) || isManager(user)) {
    return true;
  }

  // Sales rep can only qualify assigned leads
  return leadAssignedTo === user.userId;
}

/**
 * Middleware to enforce lead qualification permissions
 * Expects lead to be loaded into req.lead by a previous middleware
 *
 * Usage:
 * app.post('/api/v1/leads/:id/qualify', authenticate, loadLead, enforceLeadQualify, qualifyLead);
 */
export function enforceLeadQualify(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authReq = req as AuthenticatedRequest & {
      lead: { assigned_to: string | null };
    };

    if (!authReq.lead) {
      throw new Error(
        'Lead not loaded. Use loadLead middleware before enforceLeadQualify.'
      );
    }

    if (!canQualifyLead(authReq, authReq.lead.assigned_to)) {
      const user = getAuthenticatedUser(authReq);

      logger.warn(
        {
          userId: user.userId,
          userRole: user.role,
          leadAssignedTo: authReq.lead.assigned_to,
          path: req.path,
        },
        'Access denied: user cannot qualify this lead'
      );

      throw new AuthorizationError(
        'You do not have permission to qualify this lead. You can only qualify leads assigned to you.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
