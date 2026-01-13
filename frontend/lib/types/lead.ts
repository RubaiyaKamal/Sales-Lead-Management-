/**
 * Lead Type Definitions
 *
 * Matches backend models from backend/src/models/Lead.ts
 */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'
export type QualificationStatus = 'not_qualified' | 'in_progress' | 'qualified' | 'disqualified'
export type LeadSource = 'website' | 'referral' | 'ad' | 'cold_outreach'

export interface LeadMetadata {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  initial_message?: string
  external_score?: number
  referrer_name?: string
  referrer_email?: string
  [key: string]: any
}

export interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  lead_source: LeadSource
  status: LeadStatus
  qualification_status: QualificationStatus
  assigned_to: string | null
  created_by: string | null
  metadata: LeadMetadata
  created_at: string // ISO8601
  updated_at: string // ISO8601
  last_contacted_at: string | null
  converted_at: string | null
}

export interface LeadScore {
  id: string
  lead_id: string
  budget_score: number // 0-25
  authority_score: number // 0-25
  need_score: number // 0-25
  timeline_score: number // 0-25
  total_score: number // 0-100
  reasoning: string
  confidence: number | null // 0.0-1.0
  created_at: string // ISO8601
}

export interface LeadWithScore extends Lead {
  lead_score: LeadScore | null
}

// Request payloads
export interface CreateLeadRequest {
  name: string
  email: string
  phone?: string
  company?: string
  leadSource: LeadSource
  metadata?: LeadMetadata
}

export interface UpdateLeadRequest {
  name?: string
  email?: string
  phone?: string
  company?: string
  status?: LeadStatus
  assigned_to?: string | null
  metadata?: LeadMetadata
  previousUpdatedAt?: string // For optimistic locking
}

export interface LeadListQuery {
  page?: number
  limit?: number
  status?: LeadStatus
  qualification_status?: QualificationStatus
  lead_source?: LeadSource
  assigned_to?: string
  search?: string
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'company'
  sortOrder?: 'asc' | 'desc'
}

// Helper functions
export function getStatusColor(status: LeadStatus): string {
  const colors: Record<LeadStatus, string> = {
    new: 'bg-blue-500',
    contacted: 'bg-yellow-500',
    qualified: 'bg-green-500',
    unqualified: 'bg-red-500',
    converted: 'bg-purple-500',
  }
  return colors[status] || 'bg-gray-500'
}

export function getQualificationColor(status: QualificationStatus): string {
  const colors: Record<QualificationStatus, string> = {
    not_qualified: 'bg-gray-500',
    in_progress: 'bg-yellow-500',
    qualified: 'bg-green-500',
    disqualified: 'bg-red-500',
  }
  return colors[status] || 'bg-gray-500'
}

export function formatLeadSource(source: LeadSource): string {
  const labels: Record<LeadSource, string> = {
    website: 'Website',
    referral: 'Referral',
    ad: 'Advertisement',
    cold_outreach: 'Cold Outreach',
  }
  return labels[source] || source
}
