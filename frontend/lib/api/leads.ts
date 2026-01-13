/**
 * Lead API Endpoints
 *
 * Provides methods for lead CRUD operations
 */

import { apiClient } from './client'
import {
  Lead,
  LeadWithScore,
  CreateLeadRequest,
  UpdateLeadRequest,
  LeadListQuery,
} from '../types/lead'
import { LeadListResponse, QualifyLeadResponse } from '../types/api'

export const leadsApi = {
  /**
   * Get paginated list of leads
   * GET /api/v1/leads
   */
  async list(query?: LeadListQuery): Promise<LeadListResponse> {
    return apiClient.get<LeadListResponse>('/leads', query)
  },

  /**
   * Get single lead by ID
   * GET /api/v1/leads/:id
   */
  async get(id: string): Promise<LeadWithScore> {
    return apiClient.get<LeadWithScore>(`/leads/${id}`)
  },

  /**
   * Create new lead
   * POST /api/v1/leads
   */
  async create(data: CreateLeadRequest): Promise<Lead> {
    return apiClient.post<Lead>('/leads', data)
  },

  /**
   * Update existing lead
   * PATCH /api/v1/leads/:id
   */
  async update(id: string, data: UpdateLeadRequest): Promise<Lead> {
    return apiClient.patch<Lead>(`/leads/${id}`, data)
  },

  /**
   * Delete lead
   * DELETE /api/v1/leads/:id
   */
  async delete(
    id: string,
    options?: {
      reason?: string
      gdprRequest?: boolean
    }
  ): Promise<void> {
    const params: Record<string, string> = {}
    if (options?.reason) params.reason = options.reason
    if (options?.gdprRequest) params.gdprRequest = 'true'

    return apiClient.delete<void>(`/leads/${id}`, params)
  },

  /**
   * Qualify lead with AI
   * POST /api/v1/leads/:id/qualify
   */
  async qualify(id: string): Promise<QualifyLeadResponse> {
    return apiClient.post<QualifyLeadResponse>(`/leads/${id}/qualify`)
  },
}
