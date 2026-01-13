import twilio from 'twilio';
import { Logger } from 'pino';

interface NotificationEvent {
  type: 'email' | 'whatsapp' | 'both';
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  assignedToPhone?: string;
  eventType: 'lead.qualified' | 'lead.created' | 'lead.updated' | 'follow-up.due';
  metadata?: {
    qualificationScore?: number;
    followUpDate?: string;
    [key: string]: any;
  };
}

export class WhatsAppNotifier {
  private logger: Logger;
  private twilioClient: any;
  private fromNumber: string;

  constructor(logger: Logger) {
    this.logger = logger;
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    } else {
      this.logger.warn('TWILIO credentials not set, WhatsApp notifications will be logged but not sent');
    }
  }

  /**
   * Send WhatsApp notification based on event type
   */
  async sendNotification(event: NotificationEvent): Promise<void> {
    if (!event.assignedToPhone) {
      throw new Error('assignedToPhone is required for WhatsApp notifications');
    }

    const message = this.buildWhatsAppMessage(event);
    const to = event.assignedToPhone.startsWith('whatsapp:')
      ? event.assignedToPhone
      : `whatsapp:${event.assignedToPhone}`;

    if (!this.twilioClient) {
      this.logger.info({ to, message }, 'WhatsApp notification (dry run - no Twilio credentials)');
      return;
    }

    try {
      const result = await this.twilioClient.messages.create({
        from: this.fromNumber,
        to,
        body: message,
      });

      this.logger.info({
        to,
        messageSid: result.sid,
      }, 'WhatsApp message sent successfully');
    } catch (error) {
      this.logger.error({
        error: {},
        to,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to send WhatsApp message');
      throw error;
    }
  }

  /**
   * Build WhatsApp message based on event type
   */
  private buildWhatsAppMessage(event: NotificationEvent): string {
    switch (event.eventType) {
      case 'lead.qualified':
        return `🎯 *New Qualified Lead*\n\n` +
               `Name: ${event.leadName}\n` +
               `Score: ${event.metadata?.qualificationScore || 'N/A'}/100\n\n` +
               `This lead has been automatically qualified by AI and is ready for follow-up.\n\n` +
               `View details: https://app.leadflow-ai.example.com/leads/${event.leadId}`;

      case 'lead.created':
        return `📋 *New Lead Assigned*\n\n` +
               `Name: ${event.leadName}\n` +
               `Email: ${event.leadEmail || 'N/A'}\n\n` +
               `A new lead has been assigned to you.\n\n` +
               `View details: https://app.leadflow-ai.example.com/leads/${event.leadId}`;

      case 'lead.updated':
        return `📝 *Lead Updated*\n\n` +
               `Name: ${event.leadName}\n\n` +
               `A lead assigned to you has been updated.\n\n` +
               `View details: https://app.leadflow-ai.example.com/leads/${event.leadId}`;

      case 'follow-up.due':
        return `⏰ *Follow-up Reminder*\n\n` +
               `Name: ${event.leadName}\n` +
               `Due: ${event.metadata?.followUpDate || 'Today'}\n\n` +
               `It's time to follow up with this lead!\n\n` +
               `View details: https://app.leadflow-ai.example.com/leads/${event.leadId}`;

      default:
        return `You have a new notification for lead: ${event.leadName}\n\n` +
               `View details: https://app.leadflow-ai.example.com/leads/${event.leadId}`;
    }
  }
}
