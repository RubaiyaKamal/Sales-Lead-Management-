import express from 'express';
import { DaprServer, DaprClient, CommunicationProtocolEnum } from '@dapr/dapr';
import pino from 'pino';
import { FollowUpProcessor } from './followUpProcessor';

// Environment configuration
const PORT = process.env.PORT || 8002;
const DAPR_HOST = process.env.DAPR_HOST || 'localhost';
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  base: {
    service: 'follow-up-service',
    environment: NODE_ENV,
  },
});

// Express app for health checks
const app = express();
app.use(express.json());

// Health check endpoints
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'alive', service: 'follow-up-service' });
});

app.get('/health/ready', (_req, res) => {
  res.status(200).json({ status: 'ready', service: 'follow-up-service' });
});

// Dapr server for cron binding
const daprServer = new DaprServer({
  serverHost: '0.0.0.0',
  serverPort: PORT.toString(),
  communicationProtocol: CommunicationProtocolEnum.HTTP,
  clientOptions: {
    daprHost: DAPR_HOST,
    daprPort: DAPR_HTTP_PORT,
  },
});

// Dapr client for pub/sub
const daprClient = new DaprClient({
  daprHost: DAPR_HOST,
  daprPort: DAPR_HTTP_PORT,
  communicationProtocol: CommunicationProtocolEnum.HTTP,
});

// Initialize follow-up processor
const followUpProcessor = new FollowUpProcessor(logger, daprClient);

/**
 * Handle cron trigger from Dapr
 * This endpoint is invoked by Dapr based on the cron schedule (every 30 minutes)
 */
app.post('/followup-cron', async (_req, res) => {
  logger.info('Cron trigger received, starting follow-up processing');

  try {
    const result = await followUpProcessor.processFollowUps();

    logger.info({
      processed: result.processed,
      notified: result.notified,
      errors: result.errors,
    }, 'Follow-up processing completed');

    res.status(200).json({
      status: 'success',
      processed: result.processed,
      notified: result.notified,
      errors: result.errors,
    });
  } catch (error) {
    logger.error({
      error: {},
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to process follow-ups');

    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start Dapr server
daprServer.start().then(() => {
  logger.info({ port: PORT }, 'Follow-up service Dapr server started');
}).catch((error) => {
  logger.error({ error }, 'Failed to start Dapr server');
  process.exit(1);
});

// Start Express server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Follow-up service HTTP server started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await daprServer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await daprServer.stop();
  process.exit(0);
});
