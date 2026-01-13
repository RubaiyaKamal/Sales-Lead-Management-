/**
 * User Type Definitions
 *
 * Matches backend models from backend/src/models/User.ts
 */

export type UserRole = 'admin' | 'manager' | 'sales_rep'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  cognito_sub: string | null
  is_active: boolean
  created_at: string // ISO8601
  updated_at: string // ISO8601
  notification_preferences?: {
    email: boolean
    sms: boolean
    inApp: boolean
    leadAssigned: boolean
    leadQualified: boolean
    highValueLead: boolean
  }
}

// Helper functions
export function canDeleteLeads(role: UserRole): boolean {
  return role === 'admin'
}

export function canViewAllLeads(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canAssignLeads(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    sales_rep: 'Sales Representative',
  }
  return labels[role]
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    admin: 'bg-purple-500',
    manager: 'bg-blue-500',
    sales_rep: 'bg-green-500',
  }
  return colors[role]
}
