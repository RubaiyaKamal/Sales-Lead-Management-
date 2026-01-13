/**
 * Base API Client
 *
 * Provides fetch wrapper with:
 * - Automatic JWT token attachment
 * - Error handling
 * - Type-safe requests/responses
 */

import { ApiError } from '../types/api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3005'
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1'

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = `${API_BASE_URL}/api/${API_VERSION}`) {
    this.baseUrl = baseUrl
  }

  /**
   * Get authentication token from Better Auth session
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Get session from Better Auth API
      const response = await fetch(`${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3001'}/api/auth/get-session`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      // Better Auth returns session with token
      if (data?.session?.token) {
        return data.session.token
      }

      return null
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }

  /**
   * Make HTTP request with automatic error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    // Get auth token (Better Auth uses cookies, so this is optional)
    const token = await this.getAuthToken()

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add auth token if available (though Better Auth uses httpOnly cookies)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for Better Auth
      })

      // Handle HTTP errors
      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new ApiClientError(
          errorData.error.message,
          response.status,
          errorData.error
        )
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as T
      }

      // Parse JSON response
      const data = await response.json()
      return data
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error
      }

      // Network or parsing errors
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Network request failed',
        0,
        {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          path: endpoint,
          requestId: '',
        }
      )
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(this.cleanParams(params))}` : ''
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(this.cleanParams(params))}` : ''
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'DELETE',
    })
  }

  /**
   * Clean query parameters (remove undefined/null values)
   */
  private cleanParams(params: Record<string, any>): Record<string, string> {
    const cleaned: Record<string, string> = {}
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        cleaned[key] = String(value)
      }
    })
    return cleaned
  }
}

/**
 * Custom API Error class
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: ApiError['error']
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  isUnauthorized(): boolean {
    return this.status === 401
  }

  isForbidden(): boolean {
    return this.status === 403
  }

  isNotFound(): boolean {
    return this.status === 404
  }

  isConflict(): boolean {
    return this.status === 409
  }

  isValidationError(): boolean {
    return this.status === 400
  }

  isServerError(): boolean {
    return this.status >= 500
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
