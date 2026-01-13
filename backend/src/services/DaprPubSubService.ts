/**
 * Dapr Pub/Sub Service
 *
 * Handles event publishing to Kafka via Dapr Pub/Sub component.
 * Events are published to the lead-events topic for downstream processing.
 */

import { publishEvent } from '../lib/dapr';
import { logger } from '../lib/logger';
import { config } from '../lib/config';

/**
 * Event types
 */
export enum EventType {
  LEAD_CREATED = 'lead.created',
  LEAD_UPDATED = 'lead.updated',
  LEAD_DELETED = 'lead.deleted',
  LEAD_QUALIFIED = 'lead.qualified',
  LEAD_ASSIGNED = 'lead.assigned',
}

/**
 * Base event payload
 */
interface BaseEventPayload {
  eventType: EventType;
  timestamp: string;
  eventId: string;
}

/**
 * Lead created event payload
 */
export interface LeadCreatedEvent extends BaseEventPayload {
  eventType: EventType.LEAD_CREATED;
  data: {
    leadId: string;
    name: string;
    email: string;
    company: string | null;
    leadSource: string;
    assignedTo: string | null;
    createdBy: string;
  };
}

/**
 * Lead updated event payload
 */
export interface LeadUpdatedEvent extends BaseEventPayload {
  eventType: EventType.LEAD_UPDATED;
  data: {
    leadId: string;
    updatedBy: string;
    changedFields: string[];
    previousValues: Record<string, any>;
    newValues: Record<string, any>;
  };
}

/**
 * Lead deleted event payload
 */
export interface LeadDeletedEvent extends BaseEventPayload {
  eventType: EventType.LEAD_DELETED;
  data: {
    leadId: string;
    leadEmail: string;
    deletedBy: string;
    reason?: string;
    gdprRequest?: boolean;
  };
}

/**
 * Lead qualified event payload
 */
export interface LeadQualifiedEvent extends BaseEventPayload {
  eventType: EventType.LEAD_QUALIFIED;
  data: {
    leadId: string;
    leadName: string;
    leadEmail: string;
    totalScore: number;
    qualificationStatus: string;
    assignedTo: string | null;
  };
}

/**
 * Lead assigned event payload
 */
export interface LeadAssignedEvent extends BaseEventPayload {
  eventType: EventType.LEAD_ASSIGNED;
  data: {
    leadId: string;
    leadName: string;
    previousAssignee: string | null;
    newAssignee: string | null;
    assignedBy: string;
  };
}

/**
 * Union type for all event payloads
 */
export type EventPayload =
  | LeadCreatedEvent
  | LeadUpdatedEvent
  | LeadDeletedEvent
  | LeadQualifiedEvent
  | LeadAssignedEvent;

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Publish event to Kafka via Dapr Pub/Sub
 */
async function publishLeadEvent(payload: EventPayload): Promise<void> {
  const topic = config.kafka.topicLeadEvents;

  try {
    await publishEvent(topic, payload);

    logger.info(
      {
        eventType: payload.eventType,
        eventId: payload.eventId,
        topic,
      },
      'Event published successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        eventType: payload.eventType,
        eventId: payload.eventId,
      },
      'Failed to publish event'
    );
    throw error;
  }
}

/**
 * Publish lead.created event
 */
export async function publishLeadCreated(data: {
  leadId: string;
  name: string;
  email: string;
  company: string | null;
  leadSource: string;
  assignedTo: string | null;
  createdBy: string;
}): Promise<void> {
  const event: LeadCreatedEvent = {
    eventType: EventType.LEAD_CREATED,
    timestamp: new Date().toISOString(),
    eventId: generateEventId(),
    data,
  };

  await publishLeadEvent(event);
}

/**
 * Publish lead.updated event
 */
export async function publishLeadUpdated(data: {
  leadId: string;
  updatedBy: string;
  changedFields: string[];
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
}): Promise<void> {
  const event: LeadUpdatedEvent = {
    eventType: EventType.LEAD_UPDATED,
    timestamp: new Date().toISOString(),
    eventId: generateEventId(),
    data,
  };

  await publishLeadEvent(event);
}

/**
 * Publish lead.deleted event
 */
export async function publishLeadDeleted(data: {
  leadId: string;
  leadEmail: string;
  deletedBy: string;
  reason?: string;
  gdprRequest?: boolean;
}): Promise<void> {
  const event: LeadDeletedEvent = {
    eventType: EventType.LEAD_DELETED,
    timestamp: new Date().toISOString(),
    eventId: generateEventId(),
    data,
  };

  await publishLeadEvent(event);
}

/**
 * Publish lead.qualified event
 */
export async function publishLeadQualified(data: {
  leadId: string;
  leadName: string;
  leadEmail: string;
  totalScore: number;
  qualificationStatus: string;
  assignedTo: string | null;
}): Promise<void> {
  const event: LeadQualifiedEvent = {
    eventType: EventType.LEAD_QUALIFIED,
    timestamp: new Date().toISOString(),
    eventId: generateEventId(),
    data,
  };

  await publishLeadEvent(event);
}

/**
 * Publish lead.assigned event
 */
export async function publishLeadAssigned(data: {
  leadId: string;
  leadName: string;
  previousAssignee: string | null;
  newAssignee: string | null;
  assignedBy: string;
}): Promise<void> {
  const event: LeadAssignedEvent = {
    eventType: EventType.LEAD_ASSIGNED,
    timestamp: new Date().toISOString(),
    eventId: generateEventId(),
    data,
  };

  await publishLeadEvent(event);
}
