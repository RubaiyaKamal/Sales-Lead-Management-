/**
 * Lead Model
 *
 * Represents a potential customer in the sales pipeline.
 * Includes contact information, status tracking, and AI qualification metadata.
 */

import { LeadScore } from './LeadScore';

/**
 * Lead source enum - where the lead originated
 */
export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  AD = 'ad',
  COLD_OUTREACH = 'cold_outreach',
}

/**
 * Lead status enum - current stage in sales pipeline
 */
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  UNQUALIFIED = 'unqualified',
  CONVERTED = 'converted',
}

/**
 * Qualification status enum - AI scoring state
 */
export enum QualificationStatus {
  NOT_QUALIFIED = 'not_qualified',
  IN_PROGRESS = 'in_progress',
  QUALIFIED = 'qualified',
  DISQUALIFIED = 'disqualified',
}

/**
 * Lead metadata - flexible JSON field for custom data
 */
export interface LeadMetadata {
  /**
   * UTM parameters from web forms
   */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;

  /**
   * Original inquiry/message from lead
   */
  initial_message?: string;

  /**
   * Lead quality indicator (if from external source)
   */
  external_score?: number;

  /**
   * Referral source details
   */
  referrer_name?: string;
  referrer_email?: string;

  /**
   * Additional custom fields
   */
  [key: string]: any;
}

/**
 * Lead entity from database
 */
export interface Lead {
  /**
   * Unique identifier (UUID)
   */
  id: string;

  /**
   * Lead name (required, max 255 chars)
   */
  name: string;

  /**
   * Email address (required, unique, valid format)
   */
  email: string;

  /**
   * Phone number (optional, E.164 format)
   */
  phone: string | null;

  /**
   * Company name (optional, max 255 chars)
   */
  company: string | null;

  /**
   * Lead source (required)
   */
  lead_source: LeadSource;

  /**
   * Current status in sales pipeline
   */
  status: LeadStatus;

  /**
   * AI qualification status
   */
  qualification_status: QualificationStatus;

  /**
   * Assigned sales representative (FK to users.id)
   */
  assigned_to: string | null;

  /**
   * User who created the lead (FK to users.id)
   */
  created_by: string | null;

  /**
   * Flexible metadata (JSON)
   */
  metadata: LeadMetadata;

  /**
   * Lead creation timestamp
   */
  created_at: Date;

  /**
   * Last update timestamp (auto-updated by trigger)
   */
  updated_at: Date;

  /**
   * Last contact attempt timestamp (auto-set when status changes)
   */
  last_contacted_at: Date | null;

  /**
   * Conversion timestamp (auto-set when status = converted)
   */
  converted_at: Date | null;
}

/**
 * Lead with latest score (from JOIN LATERAL query)
 */
export interface LeadWithScore extends Lead {
  /**
   * Latest lead score (BANT breakdown)
   * Null if lead has not been qualified yet
   */
  lead_score: LeadScore | null;
}

/**
 * Create lead request payload
 */
export interface CreateLeadRequest {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  leadSource: LeadSource;
  metadata?: LeadMetadata;
}

/**
 * Update lead request payload (partial update)
 */
export interface UpdateLeadRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: LeadStatus;
  assigned_to?: string | null;
  metadata?: LeadMetadata;
  previous_updated_at?: string;
}

/**
 * Lead list query parameters
 */
export interface LeadListQuery {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  qualification_status?: QualificationStatus;
  lead_source?: LeadSource;
  assigned_to?: string;
  search?: string; // Search name, email, company
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'company';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Lead list response with pagination
 */
export interface LeadListResponse {
  data: LeadWithScore[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: {
    filters: Partial<LeadListQuery>;
  };
}

/**
 * Lead response (single lead with score)
 */
export interface LeadResponse extends LeadWithScore { }

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate E.164 phone format
 * Examples: +12025551234, +442071234567
 */
export function isValidE164Phone(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validate lead source enum
 */
export function isValidLeadSource(source: string): source is LeadSource {
  return Object.values(LeadSource).includes(source as LeadSource);
}

/**
 * Validate lead status enum
 */
export function isValidLeadStatus(status: string): status is LeadStatus {
  return Object.values(LeadStatus).includes(status as LeadStatus);
}

/**
 * Validate qualification status enum
 */
export function isValidQualificationStatus(
  status: string
): status is QualificationStatus {
  return Object.values(QualificationStatus).includes(
    status as QualificationStatus
  );
}

/**
 * Determine qualification status based on total score
 * - ≥60: qualified
 * - <40: disqualified
 * - 40-59: in_progress
 */
export function determineQualificationStatus(
  totalScore: number
): QualificationStatus {
  if (totalScore >= 60) {
    return QualificationStatus.QUALIFIED;
  } else if (totalScore < 40) {
    return QualificationStatus.DISQUALIFIED;
  } else {
    return QualificationStatus.IN_PROGRESS;
  }
}

/**
 * Check if status change should update last_contacted_at
 * Triggers when status changes to: contacted, qualified, or converted
 */
export function shouldUpdateLastContacted(newStatus: LeadStatus): boolean {
  return [
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.CONVERTED,
  ].includes(newStatus);
}

/**
 * Check if status change should update converted_at
 * Triggers when status changes to: converted
 */
export function shouldUpdateConverted(newStatus: LeadStatus): boolean {
  return newStatus === LeadStatus.CONVERTED;
}
