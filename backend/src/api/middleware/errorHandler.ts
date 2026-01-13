/**
 * Centralized Error Handling Middleware
 *
 * Provides consistent error responses across all API endpoints.
 * Handles different error types: validation, authentication, authorization, database, etc.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../lib/logger';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR',
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error types with predefined status codes and error codes
 */

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message: string = 'You do not have permission to perform this action'
  ) {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
    requestId?: string;
  };
}

/**
 * Check if error is an operational error (expected error)
 */
function isOperationalError(error: any): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract error details from different error types
 */
function extractErrorDetails(error: any): {
  statusCode: number;
  code: string;
  message: string;
  details?: any;
} {
  // AppError (our custom errors)
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // PostgreSQL unique constraint violation (duplicate email)
  if (error.code === '23505') {
    return {
      statusCode: 409,
      code: 'DUPLICATE_ENTRY',
      message: 'Resource already exists',
      details: { constraint: error.constraint },
    };
  }

  // PostgreSQL foreign key violation
  if (error.code === '23503') {
    return {
      statusCode: 400,
      code: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist',
      details: { constraint: error.constraint },
    };
  }

  // PostgreSQL check constraint violation
  if (error.code === '23514') {
    return {
      statusCode: 400,
      code: 'CONSTRAINT_VIOLATION',
      message: 'Data violates constraint',
      details: { constraint: error.constraint },
    };
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
    };
  }

  if (error.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
    };
  }

  // Joi validation errors
  if (error.name === 'ValidationError' && error.isJoi) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.details,
    };
  }

  // Default internal server error
  return {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  };
}

/**
 * Error handling middleware
 * Must be registered AFTER all routes
 */
export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const { statusCode, code, message, details } = extractErrorDetails(error);

  // Generate request ID from headers or create new one
  const requestId =
    (_req.headers['x-request-id'] as string) ||
    (_req.headers['x-amzn-trace-id'] as string) ||
    'unknown';

  // Log error based on severity
  const logContext = {
    requestId,
    method: _req.method,
    path: _req.path,
    statusCode,
    errorCode: code,
    userId: (_req as any).user?.userId,
    error: {
      message: error.message,
      stack: error.stack,
      details,
    },
  };

  if (isOperationalError(error)) {
    // Operational errors (expected) - log as warning
    logger.warn(logContext, 'Operational error occurred');
  } else {
    // Programming errors or unexpected errors - log as error
    logger.error(logContext, 'Unexpected error occurred');
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      path: _req.path,
      requestId,
    },
  };

  // Include details for 4xx errors (client errors)
  // Exclude details for 5xx errors (server errors) to prevent info leakage
  if (statusCode < 500 && details) {
    errorResponse.error.details = details;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * Catches errors from async functions and passes them to error handler
 *
 * Usage:
 * app.get('/api/leads', asyncErrorHandler(async (_req, res) => {
 *   const leads = await getLeads();
 *   res.json(leads);
 * }));
 */
export function asyncErrorHandler(
  fn: (_req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (_req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(_req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Handles requests to non-existent routes
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}

/**
 * Unhandled rejection handler (for Promise rejections)
 */
export function handleUnhandledRejection(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error(
      { reason, promise },
      'Unhandled Promise rejection detected'
    );
    // In production, you might want to exit the process
    if (process.env['NODE_ENV'] === 'production') {
      process.exit(1);
    }
  });
}

/**
 * Uncaught exception handler
 */
export function handleUncaughtException(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error }, 'Uncaught exception detected');
    // Always exit on uncaught exception
    process.exit(1);
  });
}
