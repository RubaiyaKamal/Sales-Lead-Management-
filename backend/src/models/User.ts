/**
 * User Model
 *
 * Represents a sales team member with system access.
 * Includes role-based access control (RBAC) support.
 */

/**
 * User roles for RBAC
 * - admin: Full system access, can manage all leads and users
 * - manager: Can manage team leads and view team metrics
 * - sales_rep: Can manage assigned leads only
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SALES_REP = 'sales_rep',
}

/**
 * Notification preferences for user
 */
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  leadAssigned: boolean;
  leadQualified: boolean;
  highValueLead: boolean;
}

/**
 * User entity from database
 */
export interface User {
  /**
   * Unique identifier (UUID)
   */
  id: string;

  /**
   * Email address (login credential, unique)
   */
  email: string;

  /**
   * Full name
   */
  name: string;

  /**
   * User role for RBAC
   */
  role: UserRole;

  /**
   * AWS Cognito sub (authentication reference)
   * Maps to JWT token subject claim
   */
  cognito_sub: string | null;

  /**
   * Notification preferences (JSON)
   */
  notification_preferences: NotificationPreferences;

  /**
   * Account active status
   */
  is_active: boolean;

  /**
   * User creation timestamp
   */
  created_at: Date;

  /**
   * Last update timestamp
   */
  updated_at: Date;
}

/**
 * User creation payload
 */
export interface CreateUserRequest {
  email: string;
  name: string;
  role: UserRole;
  cognito_sub?: string;
  notification_preferences?: Partial<NotificationPreferences>;
}

/**
 * User update payload (partial update)
 */
export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  notification_preferences?: Partial<NotificationPreferences>;
  is_active?: boolean;
}

/**
 * User response (excludes sensitive fields)
 */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * JWT token payload after authentication
 */
export interface JWTPayload {
  sub: string; // Cognito sub (maps to user.cognito_sub)
  email: string;
  'cognito:groups'?: string[]; // Cognito groups (optional)
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
  iss: string; // Issuer (Cognito URL)
  aud: string; // Audience (client ID)
}

/**
 * Authenticated user context (extracted from JWT)
 */
export interface AuthenticatedUser {
  userId: string; // From database lookup via cognito_sub
  email: string;
  role: UserRole;
  cognitoSub: string;
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
  inApp: true,
  leadAssigned: true,
  leadQualified: true,
  highValueLead: true,
};

/**
 * Type guard to check if user has admin role
 */
export function isAdmin(user: User | AuthenticatedUser): boolean {
  return user.role === UserRole.ADMIN;
}

/**
 * Type guard to check if user has manager role
 */
export function isManager(user: User | AuthenticatedUser): boolean {
  return user.role === UserRole.MANAGER;
}

/**
 * Type guard to check if user has sales_rep role
 */
export function isSalesRep(user: User | AuthenticatedUser): boolean {
  return user.role === UserRole.SALES_REP;
}

/**
 * Check if user has permission to access lead
 * - Admin: Access all leads
 * - Manager: Access team leads (implementation TBD - team assignment)
 * - Sales Rep: Access assigned leads only
 */
export function canAccessLead(
  user: AuthenticatedUser,
  leadAssignedTo: string | null
): boolean {
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
 * Check if user has permission to modify lead
 * - Admin: Modify all leads
 * - Manager: Modify all leads (simplified - team filtering TBD)
 * - Sales Rep: Modify assigned leads only
 */
export function canModifyLead(
  user: AuthenticatedUser,
  leadAssignedTo: string | null
): boolean {
  return canAccessLead(user, leadAssignedTo);
}

/**
 * Check if user has permission to delete lead
 * - Only admin can delete leads
 */
export function canDeleteLead(user: AuthenticatedUser): boolean {
  return isAdmin(user);
}
