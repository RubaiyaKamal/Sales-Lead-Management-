/**
 * JWT Authentication Middleware
 *
 * Validates JWT tokens from AWS Cognito and extracts user information.
 * Attaches authenticated user to request object for downstream handlers.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../lib/config';
import { logger } from '../../lib/logger';
import {
  AuthenticationError,
  AuthorizationError,
} from './errorHandler';
import { JWTPayload, AuthenticatedUser, UserRole } from '../../models/User';
import { executeQuery, executeQueryOne } from '../../lib/database';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * JWT token verification options
 */
const jwtOptions: jwt.VerifyOptions = {
  issuer: config.auth.jwtIssuer,
  audience: config.auth.jwtAudience,
  algorithms: ['RS256'], // Cognito uses RS256
};

/**
 * Extract JWT token from Authorization header
 * Expected format: "Bearer <token>"
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Verify JWT token and extract payload
 * In production, this should fetch Cognito public keys for verification
 */
async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    // NOTE: In production, you should fetch and use Cognito public keys
    // For development, we use a simple secret-based verification
    const payload = jwt.verify(
      token,
      config.auth.jwtSecret,
      jwtOptions
    ) as JWTPayload;

    return payload;
  } catch (error: any) {
    logger.error({ error }, 'JWT verification failed');

    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Authentication token has expired');
    }

    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid authentication token');
    }

    throw new AuthenticationError('Authentication failed');
  }
}

/**
 * Look up user in database by Cognito sub
 */
async function getUserByCognitoSub(
  cognitoSub: string
): Promise<AuthenticatedUser | null> {
  const query = `
    SELECT id, email, name, role, cognito_sub, is_active
    FROM users
    WHERE cognito_sub = $1 AND is_active = true
  `;

  try {
    const user = await executeQueryOne<{
      id: string;
      email: string;
      name: string;
      role: UserRole;
      cognito_sub: string;
      is_active: boolean;
    }>(query, [cognitoSub]);

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      cognitoSub: user.cognito_sub,
    };
  } catch (error) {
    logger.error({ error, cognitoSub }, 'Failed to lookup user by Cognito sub');
    throw error;
  }
}

/**
 * Extract Better Auth session token from cookies
 */
function extractSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  logger.debug({ cookieHeader }, 'Incoming request cookies');

  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const loggableCookies = cookies.map(c => c.split('=')[0]);
  logger.debug({ cookieKeys: loggableCookies }, 'Cookie keys found');

  const sessionCookie = cookies.find((c) =>
    c.startsWith('better-auth.session_token=') ||
    c.startsWith('__Host-better-auth.session_token=') ||
    c.startsWith('__Secure-better-auth.session_token=')
  );

  if (sessionCookie) {
    const fullToken = sessionCookie.split('=')[1] || null;
    if (!fullToken) return null;

    // Better Auth cookies contain: tokenId.signature
    // But the database stores only the tokenId part
    // Extract just the token ID (before the dot)
    const tokenId = fullToken.split('.')[0];
    logger.debug({ hasToken: !!tokenId, tokenLength: tokenId.length }, 'Better Auth session token found');
    return tokenId;
  }

  return null;
}

/**
 * Look up user by Better Auth session token
 */
async function getUserBySessionToken(
  token: string
): Promise<AuthenticatedUser | null> {
  const query = `
    SELECT u.id, u.email, u.name, u.role, u.cognito_sub,
           bu.id as better_id, bu.email as better_email, bu.name as better_name
    FROM "session" s
    JOIN "user" bu ON s."userId" = bu.id
    LEFT JOIN users u ON bu.email = u.email
    WHERE s.token = $1 AND s."expiresAt" > CURRENT_TIMESTAMP
  `;

  try {
    const result = await executeQuery<{
      id: string | null;
      email: string | null;
      name: string | null;
      role: UserRole | null;
      cognito_sub: string | null;
      better_id: string;
      better_email: string;
      better_name: string;
    }>(query, [token]);

    const row = result.rows[0];
    if (!row) return null;

    // If user doesn't exist in our system users table, auto-provision them
    if (!row.id) {
      logger.info({ email: row.better_email }, 'Auto-provisioning user from Better Auth');

      // Check if this is the first user (make them admin)
      const countResult = await executeQuery('SELECT COUNT(*) FROM users');
      const isFirstUser = parseInt((countResult.rows[0] as any).count, 10) === 0;
      const role = isFirstUser ? 'admin' : 'sales_rep';

      const insertQuery = `
        INSERT INTO users (id, email, name, role, cognito_sub)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING id, email, name, role, cognito_sub
      `;

      const insertResult = await executeQuery<{
        id: string;
        email: string;
        name: string;
        role: UserRole;
        cognito_sub: string;
      }>(insertQuery, [
        row.better_email,
        row.better_name,
        role,
        `better-auth|${row.better_id}`
      ]);

      const newUser = insertResult.rows[0];
      if (!newUser) {
        logger.error('Failed to create system user during auto-provisioning');
        return null;
      }

      return {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        cognitoSub: newUser.cognito_sub,
      };
    }

    return {
      userId: row.id!,
      email: row.email!,
      role: row.role!,
      cognitoSub: row.cognito_sub!,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to lookup or provision user by session token');
    return null;
  }
}

/**
 * Authentication middleware
 * Supports both JWT (Cognito) and Better Auth Sessions
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try JWT from Authorization header
    const token = extractToken(req);
    if (token) {
      try {
        const payload = await verifyToken(token);
        const user = await getUserByCognitoSub(payload.sub);
        if (user) {
          (req as AuthenticatedRequest).user = user;
          return next();
        }
      } catch (e) {
        logger.debug('JWT authentication failed, falling back to session');
      }
    }

    // 2. Try Better Auth Session from cookies
    const sessionToken = extractSessionToken(req) || token;
    if (sessionToken) {
      logger.debug({ hasSessionToken: !!sessionToken }, 'Attempting session authentication');
      const user = await getUserBySessionToken(sessionToken);
      if (user) {
        (req as AuthenticatedRequest).user = user;
        logger.debug({ userId: user.userId }, 'Session authentication successful');
        return next();
      }
      logger.debug('Session authentication failed: User not found or session expired');
    }

    logger.warn({
      hasToken: !!token,
      hasSession: !!sessionToken,
      headers: req.headers
    }, 'Authentication failed: No valid credentials');

    throw new AuthenticationError(
      'Missing or invalid authentication token. Please sign in.'
    );
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      next(error);
    } else {
      next(new AuthenticationError('Authentication failed'));
    }
  }
}

/**
 * Optional authentication middleware
 * Attempts to authenticate user but doesn't fail if token is missing
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Verify JWT token
    const payload = await verifyToken(token);

    // Look up user in database
    const user = await getUserByCognitoSub(payload.sub);

    if (user) {
      // Attach user to request
      (req as AuthenticatedRequest).user = user;

      logger.debug(
        {
          userId: user.userId,
          email: user.email,
          role: user.role,
          path: req.path,
          method: req.method,
        },
        'User authenticated (optional)'
      );
    }

    next();
  } catch (error) {
    // For optional authentication, log error but don't fail the request
    logger.warn({ error }, 'Optional authentication failed');
    next();
  }
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticated(
  req: Request
): req is AuthenticatedRequest & { user: AuthenticatedUser } {
  return !!(req as AuthenticatedRequest).user;
}

/**
 * Helper to get authenticated user from request
 * Throws error if user is not authenticated
 */
export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    throw new AuthenticationError('User is not authenticated');
  }

  return user;
}
