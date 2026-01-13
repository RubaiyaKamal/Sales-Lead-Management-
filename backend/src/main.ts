/**
 * Main Application Entry Point
 *
 * Initializes and starts the Express.js server with all middleware,
 * database connections, and Dapr integration.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { config, isDevelopment } from './lib/config';
import { logger, createLogger } from './lib/logger';
import { initializeDatabase, closeDatabase } from './lib/database';
import { initializeDaprClient, shutdownDapr } from './lib/dapr';
import { runMigrations } from './lib/migrations';
import {
  errorHandler,
  notFoundHandler,
  handleUncaughtException,
  handleUnhandledRejection,
} from './api/middleware/errorHandler';
import { createRouter } from './api/routes';

/**
 * Create and configure Express application
 */
function createApp(): Express {
  const app = express();

  // ================================================================
  // Basic Middleware
  // ================================================================

  // Parse JSON request bodies
  app.use(express.json({ limit: '10mb' }));

  // Parse URL-encoded request bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ================================================================
  // Security Middleware
  // ================================================================

  // CORS configuration
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // In development, we can be more flexible, but for Better Auth/Credentials
    // we must specify the exact origin and set Credentials to true
    const allowedOrigins = [config.security.corsOrigin, 'http://localhost:3001', 'http://127.0.0.1:3001'];
    if (origin && allowedOrigins.includes(origin) || isDevelopment()) {
      res.header('Access-Control-Allow-Origin', origin || config.security.corsOrigin);
    }

    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID, if-unmodified-since'
    );
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return; // Explicit return for OPTIONS
    }

    next(); // Ensure all code paths return a value
  });

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
    next();
  });

  // ================================================================
  // Request Logging
  // ================================================================

  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqLogger = createLogger({
      requestId:
        (req.headers['x-request-id'] as string) ||
        (req.headers['x-amzn-trace-id'] as string),
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      reqLogger.info(
        {
          statusCode: res.statusCode,
          duration,
        },
        'Request completed'
      );
    });

    next();
  });

  // ================================================================
  // Routes
  // ================================================================

  const router = createRouter();
  app.use(router);

  // ================================================================
  // Error Handling
  // ================================================================

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Initialize all services and dependencies
 */
async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing services...');

    // Initialize database connection pool
    initializeDatabase();
    logger.info('Database connection pool initialized');

    // Run database migrations
    if (config.nodeEnv !== 'test') {
      await runMigrations();
      logger.info('Database migrations completed');
    }

    // Initialize Dapr client (skip if Dapr is not available)
    try {
      initializeDaprClient();
      logger.info('Dapr client initialized');
    } catch (error) {
      logger.warn({ error }, 'Dapr client initialization failed, continuing without Dapr');
    }

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.fatal({ error }, 'Failed to initialize services');
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(
  server: any,
  signal: string
): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  try {
    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Dapr connections
    try {
      await shutdownDapr();
      logger.info('Dapr client shut down');
    } catch (error) {
      logger.warn({ error }, 'Dapr shutdown failed, continuing with shutdown');
    }

    // Close database connections
    await closeDatabase();
    logger.info('Database connections closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

/**
 * Start the application server
 */
async function startServer(): Promise<void> {
  try {
    // Set up global error handlers
    handleUncaughtException();
    handleUnhandledRejection();

    // Initialize services
    await initializeServices();

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(
        {
          port: config.port,
          environment: config.nodeEnv,
          apiVersion: config.apiVersion,
        },
        `Server started successfully`
      );

      if (isDevelopment()) {
        logger.info(
          `API available at: http://localhost:${config.port}/api/${config.apiVersion}`
        );
        logger.info(
          `Health check: http://localhost:${config.port}/health`
        );
      }
    });

    // Set up graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing
export { createApp, initializeServices, startServer };
