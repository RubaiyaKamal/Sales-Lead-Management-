/**
 * API Response Type Definitions
 *
 * Matches backend API response structures
 */

import { LeadWithScore } from './lead'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
  meta?: {
    filters: Record<string, any>
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    path: string
    requestId: string
  }
}

export interface LeadListResponse extends PaginatedResponse<LeadWithScore> {}

export interface QualifyLeadResponse {
  leadId: string
  leadName: string
  qualificationStatus: 'not_qualified' | 'in_progress' | 'qualified' | 'disqualified'
  score: {
    id: string
    budget_score: number
    authority_score: number
    need_score: number
    timeline_score: number
    total_score: number
    reasoning: string
    confidence: number
    created_at: string
  }
  breakdown: {
    budget: { score: number; percentage: number; label: string }
    authority: { score: number; percentage: number; label: string }
    need: { score: number; percentage: number; label: string }
    timeline: { score: number; percentage: number; label: string }
    total: { score: number; percentage: number; label: string }
  }
}

// Helper type for API client methods
export type ApiResponse<T> = {
  data: T
  error: null
} | {
  data: null
  error: ApiError['error']
}
