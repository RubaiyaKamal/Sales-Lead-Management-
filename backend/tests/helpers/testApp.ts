/**
 * Test Application Setup
 *
 * Creates an Express app instance for integration testing
 * without starting the server or connecting to external services.
 */

import express, { Express } from 'express';
import { createRouter } from '../../src/api/routes';
import { errorHandler, notFoundHandler } from '../../src/api/middleware/errorHandler';

/**
 * Create test Express application
 * Configures the app similarly to production but without external connections
 */
export function createTestApp(): Express {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS for testing
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');

    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  });

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Mount routes
  app.use(createRouter());

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
