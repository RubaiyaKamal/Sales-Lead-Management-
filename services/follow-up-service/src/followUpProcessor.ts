import { Pool } from 'pg';
import { DaprClient } from '@dapr/dapr';
import { Logger } from 'pino';

interface FollowUpLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string;
  assigned_to: string;
  status: string;
  next_follow_up_date: Date;
  assigned_to_email: string | null;
  assigned_to_phone: string | null;
}

interface ProcessResult {
  processed: number;
  notified: number;
  errors: number;
}

export class FollowUpProcessor {
  private logger: Logger;
  private daprClient: DaprClient;
  private dbPool: Pool;

  constructor(logger: Logger, daprClient: DaprClient) {
    this.logger = logger;
    this.daprClient = daprClient;

    // Initialize database connection pool
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  /**
   * Process all leads with follow-ups due today or earlier
   */
  async processFollowUps(): Promise<ProcessResult> {
    const result: ProcessResult = {
      processed: 0,
      notified: 0,
      errors: 0,
    };

    try {
      // Query leads with follow-ups due
      const leads = await this.getLeadsDueForFollowUp();

      this.logger.info({ count: leads.length }, 'Found leads due for follow-up');

      for (const lead of leads) {
        try {
          await this.processLead(lead);
          result.processed++;
          result.notified++;
        } catch (error) {
          this.logger.error({
            error: {},
            leadId: lead.id,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          }, 'Failed to process lead follow-up');
          result.errors++;
        }
      }

      return result;
    } catch (error) {
      this.logger.error({
        error: {},
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to query leads for follow-up');
      throw error;
    }
  }

  /**
   * Get leads with follow-ups due today or earlier
   */
  private async getLeadsDueForFollowUp(): Promise<FollowUpLead[]> {
    const query = `
      SELECT
        l.id,
        l.name,
        l.email,
        l.phone,
        l.company,
        l.assigned_to,
        l.status,
        l.next_follow_up_date,
        u.email as assigned_to_email,
        u.phone as assigned_to_phone
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE
        l.next_follow_up_date IS NOT NULL
        AND l.next_follow_up_date <= NOW()
        AND l.status IN ('contacted', 'qualified', 'in_progress')
        AND l.assigned_to IS NOT NULL
      ORDER BY l.next_follow_up_date ASC
      LIMIT 100
    `;

    const result = await this.dbPool.query<FollowUpLead>(query);
    return result.rows;
  }

  /**
   * Process a single lead follow-up
   */
  private async processLead(lead: FollowUpLead): Promise<void> {
    this.logger.info({ leadId: lead.id, name: lead.name }, 'Processing follow-up for lead');

    // Publish notification event to Kafka
    await this.publishNotificationEvent(lead);

    // Publish follow-up event to Kafka for analytics/tracking
    await this.publishFollowUpEvent(lead);

    // Update lead's next_follow_up_date (optional - can be done manually by sales rep)
    // For now, we just send notifications without updating the follow-up date
    this.logger.info({ leadId: lead.id }, 'Follow-up notification sent');
  }

  /**
   * Publish notification event to Kafka for email/WhatsApp notifications
   */
  private async publishNotificationEvent(lead: FollowUpLead): Promise<void> {
    const notificationEvent = {
      type: 'both', // Send both email and WhatsApp
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      leadPhone: lead.phone || undefined,
      assignedToEmail: lead.assigned_to_email || undefined,
      assignedToPhone: lead.assigned_to_phone || undefined,
      eventType: 'follow-up.due',
      metadata: {
        followUpDate: lead.next_follow_up_date.toISOString(),
        status: lead.status,
        company: lead.company,
      },
    };

    try {
      await this.daprClient.pubsub.publish(
        'kafka-pubsub',
        'notifications',
        notificationEvent
      );

      this.logger.info({ leadId: lead.id }, 'Notification event published');
    } catch (error) {
      this.logger.error({
        error: {},
        leadId: lead.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to publish notification event');
      throw error;
    }
  }

  /**
   * Publish follow-up event to Kafka for analytics/tracking
   */
  private async publishFollowUpEvent(lead: FollowUpLead): Promise<void> {
    const followUpEvent = {
      eventType: 'follow-up.processed',
      leadId: lead.id,
      leadName: lead.name,
      assignedTo: lead.assigned_to,
      followUpDate: lead.next_follow_up_date.toISOString(),
      status: lead.status,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.daprClient.pubsub.publish(
        'kafka-pubsub',
        'follow-up-events',
        followUpEvent
      );

      this.logger.info({ leadId: lead.id }, 'Follow-up event published');
    } catch (error) {
      this.logger.error({
        error: {},
        leadId: lead.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to publish follow-up event');
      // Don't throw - notification is more important than analytics event
    }
  }

  /**
   * Close database connection pool (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.dbPool.end();
    this.logger.info('Database connection pool closed');
  }
}
