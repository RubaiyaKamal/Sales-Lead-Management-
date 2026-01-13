/**
 * ActivityLog Model
 *
 * Represents audit trail of all actions performed on leads.
 * Provides complete history for compliance (GDPR), analytics, and debugging.
 */

/**
 * Activity action types - all operations that can be performed on leads
 */
export enum ActivityAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  QUALIFY = 'qualify',
  ASSIGN = 'assign',
  STATUS_CHANGE = 'status_change',
  VIEW = 'view',
}

/**
 * Activity metadata - flexible JSON field for action-specific data
 */
export interface ActivityMetadata {
  /**
   * For UPDATE actions: changed fields and their previous/new values
   */
  changed_fields?: {
    field: string;
    previous_value: any;
    new_value: any;
  }[];

  /**
   * For QUALIFY actions: qualification score and reasoning
   */
  qualification_score?: number;
  qualification_reasoning?: string;

  /**
   * For ASSIGN actions: previous and new assignee
   */
  previous_assignee?: string | null;
  new_assignee?: string | null;

  /**
   * For STATUS_CHANGE actions: previous and new status
   */
  previous_status?: string;
  new_status?: string;

  /**
   * For DELETE actions: reason and GDPR compliance flag
   */
  deletion_reason?: string;
  gdpr_request?: boolean;

  /**
   * IP address of user performing action (for security audit)
   */
  ip_address?: string;

  /**
   * User agent string (for security audit)
   */
  user_agent?: string;

  /**
   * Additional custom fields
   */
  [key: string]: any;
}

/**
 * ActivityLog entity from database
 */
export interface ActivityLog {
  /**
   * Unique identifier (UUID)
   */
  id: string;

  /**
   * Associated lead (FK to leads.id)
   */
  lead_id: string;

  /**
   * User who performed the action (FK to users.id)
   */
  user_id: string | null; // Null for system-generated actions

  /**
   * Action type
   */
  action: ActivityAction;

  /**
   * Human-readable description of the action
   */
  description: string;

  /**
   * Action-specific metadata (JSON)
   */
  metadata: ActivityMetadata;

  /**
   * Activity creation timestamp
   */
  created_at: Date;
}

/**
 * Create activity log request
 */
export interface CreateActivityLogRequest {
  lead_id: string;
  user_id: string | null;
  action: ActivityAction;
  description: string;
  metadata?: ActivityMetadata;
}

/**
 * Activity log list query parameters
 */
export interface ActivityLogListQuery {
  lead_id?: string; // Filter by lead
  user_id?: string; // Filter by user
  action?: ActivityAction; // Filter by action type
  from_date?: Date; // Filter by date range (start)
  to_date?: Date; // Filter by date range (end)
  page?: number;
  limit?: number;
}

/**
 * Activity log list response with pagination
 */
export interface ActivityLogListResponse {
  data: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Validate activity action enum
 */
export function isValidActivityAction(
  action: string
): action is ActivityAction {
  return Object.values(ActivityAction).includes(action as ActivityAction);
}

/**
 * Generate description for lead creation
 */
export function generateCreateDescription(leadName: string): string {
  return `Lead "${leadName}" created`;
}

/**
 * Generate description for lead update
 */
export function generateUpdateDescription(
  leadName: string,
  changedFields: string[]
): string {
  return `Lead "${leadName}" updated: ${changedFields.join(', ')}`;
}

/**
 * Generate description for lead deletion
 */
export function generateDeleteDescription(
  leadName: string,
  gdprRequest: boolean
): string {
  return gdprRequest
    ? `Lead "${leadName}" permanently deleted (GDPR request)`
    : `Lead "${leadName}" permanently deleted`;
}

/**
 * Generate description for lead qualification
 */
export function generateQualifyDescription(
  leadName: string,
  score: number,
  status: string
): string {
  return `Lead "${leadName}" qualified with score ${score}/100 (${status})`;
}

/**
 * Generate description for lead assignment
 */
export function generateAssignDescription(
  leadName: string,
  assigneeName: string
): string {
  return `Lead "${leadName}" assigned to ${assigneeName}`;
}

/**
 * Generate description for status change
 */
export function generateStatusChangeDescription(
  leadName: string,
  previousStatus: string,
  newStatus: string
): string {
  return `Lead "${leadName}" status changed from "${previousStatus}" to "${newStatus}"`;
}

/**
 * Generate description for lead view
 */
export function generateViewDescription(leadName: string): string {
  return `Lead "${leadName}" viewed`;
}

/**
 * Extract changed fields from update metadata
 */
export function extractChangedFields(
  metadata: ActivityMetadata
): string[] {
  if (!metadata.changed_fields) {
    return [];
  }
  return metadata.changed_fields.map((change) => change.field);
}

/**
 * Create metadata for update action
 */
export function createUpdateMetadata(
  changedFields: { field: string; previous_value: any; new_value: any }[],
  ipAddress?: string,
  userAgent?: string
): ActivityMetadata {
  return {
    changed_fields: changedFields,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}

/**
 * Create metadata for qualify action
 */
export function createQualifyMetadata(
  score: number,
  reasoning: string,
  ipAddress?: string,
  userAgent?: string
): ActivityMetadata {
  return {
    qualification_score: score,
    qualification_reasoning: reasoning,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}

/**
 * Create metadata for delete action
 */
export function createDeleteMetadata(
  reason: string,
  gdprRequest: boolean,
  ipAddress?: string,
  userAgent?: string
): ActivityMetadata {
  return {
    deletion_reason: reason,
    gdpr_request: gdprRequest,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}

/**
 * Create metadata for assign action
 */
export function createAssignMetadata(
  previousAssignee: string | null,
  newAssignee: string | null,
  ipAddress?: string,
  userAgent?: string
): ActivityMetadata {
  return {
    previous_assignee: previousAssignee,
    new_assignee: newAssignee,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}

/**
 * Create metadata for status change action
 */
export function createStatusChangeMetadata(
  previousStatus: string,
  newStatus: string,
  ipAddress?: string,
  userAgent?: string
): ActivityMetadata {
  return {
    previous_status: previousStatus,
    new_status: newStatus,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}
