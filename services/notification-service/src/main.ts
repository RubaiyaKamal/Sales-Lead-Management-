import express from 'express';
import { DaprServer, CommunicationProtocolEnum } from '@dapr/dapr';
import pino from 'pino';
import { EmailNotifier } from './notifiers/emailNotifier';
import { WhatsAppNotifier } from './notifiers/whatsappNotifier';

// Environment configuration
const PORT = process.env.PORT || 8001;
const DAPR_HOST = process.env.DAPR_HOST || 'localhost';
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  base: {
    service: 'notification-service',
    environment: NODE_ENV,
  },
});

// Initialize notifiers
const emailNotifier = new EmailNotifier(logger);
const whatsappNotifier = new WhatsAppNotifier(logger);

// Express app for health checks
const app = express();
app.use(express.json());

// Health check endpoints
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'alive', service: 'notification-service' });
});

app.get('/health/ready', (_req, res) => {
  res.status(200).json({ status: 'ready', service: 'notification-service' });
});

// Dapr server for pub/sub subscriptions
const daprServer = new DaprServer({
  serverHost: '0.0.0.0',
  serverPort: PORT.toString(),
  communicationProtocol: CommunicationProtocolEnum.HTTP,
  clientOptions: {
    daprHost: DAPR_HOST,
    daprPort: DAPR_HTTP_PORT,
  },
});

/**
 * Notification event payload interface
 */
interface NotificationEvent {
  type: 'email' | 'whatsapp' | 'both';
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  assignedToEmail?: string;
  assignedToPhone?: string;
  eventType: 'lead.qualified' | 'lead.created' | 'lead.updated' | 'follow-up.due';
  metadata?: {
    qualificationScore?: number;
    followUpDate?: string;
    [key: string]: any;
  };
}

/**
 * Subscribe to notifications topic
 */
daprServer.pubsub.subscribe('kafka-pubsub', 'notifications', async (data: NotificationEvent) => {
  logger.info({
    leadId: data.leadId,
    type: data.type,
    eventType: data.eventType,
  }, 'Received notification event');

  try {
    // Send email notification
    if (data.type === 'email' || data.type === 'both') {
      if (data.assignedToEmail) {
        await emailNotifier.sendNotification(data);
        logger.info({ leadId: data.leadId, email: data.assignedToEmail }, 'Email notification sent');
      } else {
        logger.warn({ leadId: data.leadId }, 'Email notification requested but no recipient email provided');
      }
    }

    // Send WhatsApp notification
    if (data.type === 'whatsapp' || data.type === 'both') {
      if (data.assignedToPhone) {
        await whatsappNotifier.sendNotification(data);
        logger.info({ leadId: data.leadId, phone: data.assignedToPhone }, 'WhatsApp notification sent');
      } else {
        logger.warn({ leadId: data.leadId }, 'WhatsApp notification requested but no recipient phone provided');
      }
    }

    logger.info({ leadId: data.leadId }, 'Notification processed successfully');
  } catch (error) {
    logger.error({
      error: {},
      leadId: data.leadId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }, 'Failed to send notification');
    throw error; // Let Dapr handle retry
  }
});

// Start Dapr server
daprServer.start().then(() => {
  logger.info({ port: PORT }, 'Notification service Dapr server started');
}).catch((error) => {
  logger.error({ error }, 'Failed to start Dapr server');
  process.exit(1);
});

// Start Express server (for health checks)
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Notification service HTTP server started');
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
