/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse by limiting requests per user/IP.
 * Uses express-rate-limit with Redis store (via Dapr State Store).
 *
 * Default limit: 100 requests per hour per user
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../../lib/config';
import { logger } from '../../lib/logger';
import { RateLimitError } from './errorHandler';
import { AuthenticatedRequest } from './auth';


/**
 * Get identifier for rate limiting
 * Prefers authenticated user ID, falls back to IP address
 */
function getIdentifier(req: Request): string {
  const authReq = req as AuthenticatedRequest;

  // If user is authenticated, use user ID
  if (authReq.user) {
    return `user:${authReq.user.userId}`;
  }

  // Otherwise, use IP address
  const ip =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Custom handler when rate limit is exceeded
 */
function rateLimitHandler(req: Request, _res: Response): void {
  const identifier = getIdentifier(req);

  logger.warn(
    {
      identifier,
      path: req.path,
      method: req.method,
      ip: req.ip,
    },
    'Rate limit exceeded'
  );

  throw new RateLimitError(
    `Too many requests. Please try again later. Limit: ${config.rateLimit.maxRequests} requests per hour.`
  );
}

/**
 * Skip rate limiting for certain conditions
 */
function skipRateLimit(req: Request): boolean {
  // Skip rate limiting if disabled in config
  if (!config.features.rateLimiting) {
    return true;
  }

  // Skip for health check endpoints
  if (req.path.startsWith('/health')) {
    return true;
  }

  return false;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(): RateLimitRequestHandler {
  // Note: For production, implement custom store using DaprRateLimitStore
  // For now, using memory store as fallback

  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests, please try again later',
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skip: skipRateLimit,
    handler: rateLimitHandler,
    keyGenerator: getIdentifier,
    // store: new DaprRateLimitStore(), // TODO: Implement custom store adapter
  });
}

/**
 * Global rate limiter middleware
 * Applied to all API routes
 */
export const globalRateLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive operations
 * Lower limits for operations like lead creation, qualification
 */
export const strictRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: Math.floor(config.rateLimit.maxRequests / 2), // Half the global limit
  message: 'Too many requests for this operation, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  handler: rateLimitHandler,
  keyGenerator: getIdentifier,
});

/**
 * Rate limiter for authentication endpoints
 * More restrictive to prevent brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth attempts
  handler: rateLimitHandler,
  keyGenerator: (req: Request) => {
    // For auth endpoints, always use IP (no user ID yet)
    const ip =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      'unknown';
    return `auth:${ip}`;
  },
});

/**
 * Log rate limit status for monitoring
 */
export function logRateLimitStatus(req: Request, res: Response): void {
  const rateLimitInfo = {
    limit: res.getHeader('RateLimit-Limit'),
    remaining: res.getHeader('RateLimit-Remaining'),
    reset: res.getHeader('RateLimit-Reset'),
  };

  if (rateLimitInfo.remaining !== undefined) {
    logger.debug(
      {
        identifier: getIdentifier(req),
        path: req.path,
        ...rateLimitInfo,
      },
      'Rate limit status'
    );
  }
}
