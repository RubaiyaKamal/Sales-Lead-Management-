/**
 * Test Authentication Helpers
 *
 * Utilities for generating valid JWT tokens for testing
 */

import jwt from 'jsonwebtoken';
import { config } from '../../src/lib/config';
import { UserRole } from '../../src/models/User';

export interface TestUserPayload {
  userId: string;
  email?: string;
  role?: UserRole;
  name?: string;
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(payload: TestUserPayload): string {
  const tokenPayload = {
    sub: payload.userId,
    userId: payload.userId,
    email: payload.email || 'test@example.com',
    role: payload.role || UserRole.SALES_REP,
    name: payload.name || 'Test User',
    'cognito:username': payload.userId,
  };

  // Use HS256 for testing (simpler than RS256 which requires key pairs)
  return jwt.sign(tokenPayload, config.auth.jwtSecret, {
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    expiresIn: '1h',
    algorithm: 'HS256', // Test environment uses HS256 instead of RS256
  });
}

/**
 * Create default test user token
 */
export function createTestUserToken(userId = 'test-user-123'): string {
  return generateTestToken({
    userId,
    email: 'testuser@example.com',
    role: UserRole.SALES_REP,
    name: 'Test User',
  });
}

/**
 * Create admin user token
 */
export function createAdminToken(userId = 'admin-user-123'): string {
  return generateTestToken({
    userId,
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    name: 'Admin User',
  });
}

/**
 * Create manager user token
 */
export function createManagerToken(userId = 'manager-user-123'): string {
  return generateTestToken({
    userId,
    email: 'manager@example.com',
    role: UserRole.MANAGER,
    name: 'Manager User',
  });
}
