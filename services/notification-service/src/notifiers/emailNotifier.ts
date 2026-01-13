import sgMail from '@sendgrid/mail';
import { Logger } from 'pino';

interface NotificationEvent {
  type: 'email' | 'whatsapp' | 'both';
  leadId: string;
  leadName: string;
  leadEmail?: string;
  assignedToEmail?: string;
  eventType: 'lead.qualified' | 'lead.created' | 'lead.updated' | 'follow-up.due';
  metadata?: {
    qualificationScore?: number;
    followUpDate?: string;
    [key: string]: any;
  };
}

export class EmailNotifier {
  private logger: Logger;
  private sendgridApiKey: string;
  private fromEmail: string;

  constructor(logger: Logger) {
    this.logger = logger;
    this.sendgridApiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.FROM_EMAIL || 'notifications@leadflow-ai.example.com';

    if (this.sendgridApiKey) {
      sgMail.setApiKey(this.sendgridApiKey);
    } else {
      this.logger.warn('SENDGRID_API_KEY not set, email notifications will be logged but not sent');
    }
  }

  /**
   * Send email notification based on event type
   */
  async sendNotification(event: NotificationEvent): Promise<void> {
    if (!event.assignedToEmail) {
      throw new Error('assignedToEmail is required for email notifications');
    }

    const { subject, html, text } = this.buildEmailContent(event);

    const msg = {
      to: event.assignedToEmail,
      from: this.fromEmail,
      subject,
      text,
      html,
    };

    if (!this.sendgridApiKey) {
      this.logger.info({ msg }, 'Email notification (dry run - no SendGrid API key)');
      return;
    }

    try {
      await sgMail.send(msg);
      this.logger.info({ to: event.assignedToEmail, subject }, 'Email sent successfully');
    } catch (error) {
      this.logger.error({
        error: {},
        to: event.assignedToEmail,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to send email');
      throw error;
    }
  }

  /**
   * Build email content based on event type
   */
  private buildEmailContent(event: NotificationEvent): { subject: string; html: string; text: string } {
    switch (event.eventType) {
      case 'lead.qualified':
        return {
          subject: `🎯 New Qualified Lead: ${event.leadName}`,
          html: `
            <h2>New Qualified Lead</h2>
            <p><strong>Lead Name:</strong> ${event.leadName}</p>
            <p><strong>Email:</strong> ${event.leadEmail || 'N/A'}</p>
            <p><strong>Qualification Score:</strong> ${event.metadata?.qualificationScore || 'N/A'}/100</p>
            <p>This lead has been automatically qualified by AI and is ready for follow-up.</p>
            <p><a href="https://app.leadflow-ai.example.com/leads/${event.leadId}">View Lead Details</a></p>
          `,
          text: `New Qualified Lead: ${event.leadName}\nQualification Score: ${event.metadata?.qualificationScore || 'N/A'}/100\n\nView details: https://app.leadflow-ai.example.com/leads/${event.leadId}`,
        };

      case 'lead.created':
        return {
          subject: `📋 New Lead Assigned: ${event.leadName}`,
          html: `
            <h2>New Lead Assigned to You</h2>
            <p><strong>Lead Name:</strong> ${event.leadName}</p>
            <p><strong>Email:</strong> ${event.leadEmail || 'N/A'}</p>
            <p>A new lead has been assigned to you. Please review and take appropriate action.</p>
            <p><a href="https://app.leadflow-ai.example.com/leads/${event.leadId}">View Lead Details</a></p>
          `,
          text: `New Lead Assigned: ${event.leadName}\n\nView details: https://app.leadflow-ai.example.com/leads/${event.leadId}`,
        };

      case 'lead.updated':
        return {
          subject: `📝 Lead Updated: ${event.leadName}`,
          html: `
            <h2>Lead Updated</h2>
            <p><strong>Lead Name:</strong> ${event.leadName}</p>
            <p><strong>Email:</strong> ${event.leadEmail || 'N/A'}</p>
            <p>A lead assigned to you has been updated.</p>
            <p><a href="https://app.leadflow-ai.example.com/leads/${event.leadId}">View Lead Details</a></p>
          `,
          text: `Lead Updated: ${event.leadName}\n\nView details: https://app.leadflow-ai.example.com/leads/${event.leadId}`,
        };

      case 'follow-up.due':
        return {
          subject: `⏰ Follow-up Reminder: ${event.leadName}`,
          html: `
            <h2>Follow-up Due</h2>
            <p><strong>Lead Name:</strong> ${event.leadName}</p>
            <p><strong>Email:</strong> ${event.leadEmail || 'N/A'}</p>
            <p><strong>Follow-up Date:</strong> ${event.metadata?.followUpDate || 'Today'}</p>
            <p>It's time to follow up with this lead. Don't let this opportunity slip away!</p>
            <p><a href="https://app.leadflow-ai.example.com/leads/${event.leadId}">View Lead Details</a></p>
          `,
          text: `Follow-up Reminder: ${event.leadName}\nFollow-up Date: ${event.metadata?.followUpDate || 'Today'}\n\nView details: https://app.leadflow-ai.example.com/leads/${event.leadId}`,
        };

      default:
        return {
          subject: `Notification: ${event.leadName}`,
          html: `<p>You have a new notification for lead: ${event.leadName}</p>`,
          text: `You have a new notification for lead: ${event.leadName}`,
        };
    }
  }
}
