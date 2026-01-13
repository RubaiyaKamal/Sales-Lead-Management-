import pino from 'pino';
import type { Logger } from 'pino';

/**
 * Creates a structured JSON logger using Pino with support for
 * trace IDs (X-Ray format), contextual metadata, and log levels.
 *
 * Features:
 * - Structured JSON logging for easy parsing and analysis
 * - Pretty printing in development mode
 * - Trace ID support for distributed tracing
 * - Contextual metadata (user_id, lead_id, operation)
 * - Multiple log levels (trace, debug, info, warn, error, fatal)
 */

// Get log level from environment, default to 'info'
const logLevel = process.env['LOG_LEVEL'] || 'info';
const prettyPrint = process.env['LOG_PRETTY'] === 'true';

// Base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'leadflow-backend',
    environment: process.env['NODE_ENV'] || 'development',
  },
};

// Add pretty printing for development
const transport = prettyPrint
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

// Create the base logger
const baseLogger: Logger = pino(
  transport ? { ...loggerConfig, transport } : loggerConfig
);

/**
 * Create a child logger with contextual metadata
 * @param context - Contextual metadata (user_id, lead_id, operation, etc.)
 * @returns Pino logger instance with bound context
 */
export function createLogger(context: Record<string, any> = {}): Logger {
  return baseLogger.child(context);
}

/**
 * Log with trace ID for distributed tracing (AWS X-Ray format)
 * @param traceId - X-Ray trace ID (format: 1-{unix-time}-{random-hex})
 * @param context - Additional contextual metadata
 * @returns Pino logger instance with trace ID
 */
export function createLoggerWithTrace(
  traceId: string,
  context: Record<string, any> = {}
): Logger {
  return baseLogger.child({
    ...context,
    traceId,
  });
}

/**
 * Create a logger for a specific operation type
 * @param operation - Operation name (e.g., 'createLead', 'qualifyLead')
 * @param metadata - Additional metadata
 * @returns Pino logger instance with operation context
 */
export function createOperationLogger(
  operation: string,
  metadata: Record<string, any> = {}
): Logger {
  return baseLogger.child({
    operation,
    ...metadata,
  });
}

// Export the base logger as default
export const logger = baseLogger;

// Export types
export type { Logger };

/**
 * Log levels (in order of severity):
 * - trace: Very detailed logs (rarely used)
 * - debug: Detailed information for debugging
 * - info: General informational messages
 * - warn: Warning messages (non-critical issues)
 * - error: Error messages (recoverable errors)
 * - fatal: Fatal errors (application crash)
 *
 * Usage examples:
 *
 * logger.info({ userId: '123' }, 'User logged in');
 * logger.error({ error: err, leadId: '456' }, 'Failed to create lead');
 *
 * const reqLogger = createLoggerWithTrace(req.headers['x-amzn-trace-id']);
 * reqLogger.info({ method: 'POST', path: '/api/v1/leads' }, 'Request received');
 *
 * const opLogger = createOperationLogger('qualifyLead', { leadId: '789' });
 * opLogger.debug('Sending request to Claude API');
 * opLogger.info({ score: 85 }, 'Lead qualification complete');
 */
