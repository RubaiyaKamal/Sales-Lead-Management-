/**
 * Health Check Handlers
 *
 * Provides liveness and readiness probes for Kubernetes health monitoring.
 * - /health/live: Liveness probe (is the service running?)
 * - /health/ready: Readiness probe (is the service ready to accept traffic?)
 */

import { Request, Response } from 'express';
import { checkDatabaseHealth, getDatabaseStats } from '../../lib/database';
import { getDaprClient } from '../../lib/dapr';
import { logger } from '../../lib/logger';
import { config } from '../../lib/config';

/**
 * Health status response
 */
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks?: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
      details?: any;
    };
  };
}

/**
 * Application start time
 */
const startTime = Date.now();

/**
 * Get application version from package.json
 */
function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../../../package.json');
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Calculate uptime in seconds
 */
function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Liveness probe handler
 * Returns 200 if service is alive (process is running)
 * This is a simple check that doesn't verify dependencies
 *
 * GET /health/live
 */
export async function handleLivenessProbe(
  _req: Request,
  res: Response
): Promise<void> {
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    version: getVersion(),
  };

  logger.debug('Liveness probe check');

  res.status(200).json(status);
}

/**
 * Readiness probe handler
 * Returns 200 if service is ready to accept traffic
 * Checks dependencies: database, Dapr
 *
 * GET /health/ready
 */
export async function handleReadinessProbe(
  _req: Request,
  res: Response
): Promise<void> {
  const checks: HealthStatus['checks'] = {};
  let isReady = true;

  // Check database connection
  try {
    const dbHealthy = await checkDatabaseHealth();
    checks['database'] = {
      status: dbHealthy ? 'up' : 'down',
      details: dbHealthy ? getDatabaseStats() : undefined,
    };

    if (!dbHealthy) {
      isReady = false;
    }
  } catch (error: any) {
    checks['database'] = {
      status: 'down',
      message: error.message,
    };
    isReady = false;
  }

  // Check Dapr connection
  try {
    const daprClient = getDaprClient();
    checks['dapr'] = {
      status: daprClient ? 'up' : 'down',
    };

    if (!daprClient) {
      isReady = false;
    }
  } catch (error: any) {
    checks['dapr'] = {
      status: 'down',
      message: error.message,
    };
    isReady = false;
  }

  const status: HealthStatus = {
    status: isReady ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    version: getVersion(),
    checks,
  };

  const statusCode = isReady ? 200 : 503;

  logger.debug(
    {
      status: status.status,
      checks,
    },
    'Readiness probe check'
  );

  res.status(statusCode).json(status);
}

/**
 * Detailed health check handler (optional, for debugging)
 * Returns comprehensive health information
 *
 * GET /health
 */
export async function handleHealthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  const checks: HealthStatus['checks'] = {};
  let isHealthy = true;

  // Check database connection
  try {
    const dbHealthy = await checkDatabaseHealth();
    const dbStats = getDatabaseStats();

    checks['database'] = {
      status: dbHealthy ? 'up' : 'down',
      details: {
        healthy: dbHealthy,
        pool: dbStats,
      },
    };

    if (!dbHealthy) {
      isHealthy = false;
    }
  } catch (error: any) {
    checks['database'] = {
      status: 'down',
      message: error.message,
    };
    isHealthy = false;
  }

  // Check Dapr connection
  try {
    const daprClient = getDaprClient();
    checks['dapr'] = {
      status: daprClient ? 'up' : 'down',
      details: {
        host: config.dapr.host,
        httpPort: config.dapr.httpPort,
        grpcPort: config.dapr.grpcPort,
      },
    };

    if (!daprClient) {
      isHealthy = false;
    }
  } catch (error: any) {
    checks['dapr'] = {
      status: 'down',
      message: error.message,
    };
    isHealthy = false;
  }

  // Check feature flags
  checks['features'] = {
    status: 'up',
    details: {
      cache: config.features.cache,
      aiQualification: config.features.aiQualification,
      rateLimiting: config.features.rateLimiting,
    },
  };

  // Check environment
  checks['environment'] = {
    status: 'up',
    details: {
      nodeEnv: config.nodeEnv,
      port: config.port,
      apiVersion: config.apiVersion,
    },
  };

  const status: HealthStatus = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    version: getVersion(),
    checks,
  };

  const statusCode = isHealthy ? 200 : 503;

  logger.info(
    {
      status: status.status,
      checks: Object.keys(checks).reduce(
        (acc, key) => ({
          ...acc,
          [key]: checks[key]?.status,
        }),
        {}
      ),
    },
    'Health check requested'
  );

  res.status(statusCode).json(status);
}
