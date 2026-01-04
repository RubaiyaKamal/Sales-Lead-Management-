/**
 * Mock Authentication Middleware for Testing
 *
 * Replaces the real JWT verification with a simple mock that
 * extracts user info from a test token without database lookups.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../src/lib/config';
import { AuthenticatedRequest } from '../../src/api/middleware/auth';
import { AuthenticationError } from '../../src/api/middleware/errorHandler';
import { UserRole } from '../../src/models/User';

/**
 * Mock authenticate middleware for testing
 * Does NOT require database lookups - extracts user from token payload
 */
export function mockAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new AuthenticationError('Missing authentication token');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format');
  }

  const token = parts[1];

  try {
    // Verify token (HS256 for testing)
    const payload = jwt.verify(token, config.auth.jwtSecret, {
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
      algorithms: ['HS256'], // HS256 for testing
    }) as any;

    // Attach user to request (no database lookup needed)
    authReq.user = {
      userId: payload.userId || payload.sub,
      email: payload.email || 'test@example.com',
      role: payload.role || UserRole.SALES_REP,
      cognitoSub: payload.sub || payload.userId,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Authentication token has expired');
    }

    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid authentication token');
    }

    throw new AuthenticationError('Authentication failed');
  }
}
