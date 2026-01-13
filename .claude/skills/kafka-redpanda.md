---
description: Expert assistance with Kafka/Redpanda setup, topics, producers, consumers, and event schemas
---

# SKILL: Kafka/Redpanda Event Streaming

## CONTEXT

The user needs help with Kafka or Redpanda event streaming including:

- Kafka/Redpanda setup and configuration
- Topic creation and management
- Producer implementation (publishing events)
- Consumer implementation (subscribing to events)
- Event schema design with validation
- Best practices for event-driven architecture

**User's specific request:**

$ARGUMENTS

## YOUR ROLE

Act as an event streaming expert with knowledge in:

- Kafka and Redpanda architecture
- Event-driven architecture patterns
- Schema design and evolution
- Producer and consumer best practices
- Partitioning and scaling strategies
- Message ordering and delivery guarantees

## OUTPUT STRUCTURE

### Step 1: Understand Use Case

Clarify:
- What events need to be published/consumed?
- What is the expected message volume?
- What are the ordering requirements?
- What language/framework is being used?
- Local development or production deployment?

### Step 2: Setup Configuration

Provide setup instructions:

**Docker Compose (local development):**
```yaml
version: '3'
services:
  redpanda:
    image: docker.redpanda.com/redpandadata/redpanda:latest
    command:
      - redpanda start
      - --smp 1
      - --overprovisioned
      - --kafka-addr internal://0.0.0.0:9092,external://0.0.0.0:19092
      - --advertise-kafka-addr internal://redpanda:9092,external://localhost:19092
    ports:
      - "19092:19092"
      - "9644:9644"
```

**Or Kubernetes configuration** for production

### Step 3: Topic Configuration

Create topic management scripts:
```bash
# Topic creation with appropriate partitions and replication
rpk topic create <topic-name> \
  --partitions 3 \
  --replicas 1 \
  --topic-config retention.ms=604800000
```

Define topic naming conventions and configuration

### Step 4: Event Schema Design

Design event schemas (using JSON Schema, Avro, or Protobuf):

```typescript
// Example event schema
interface TaskCreatedEvent {
  eventId: string;
  eventType: 'task.created';
  timestamp: string;
  version: '1.0';
  data: {
    taskId: string;
    title: string;
    userId: string;
    createdAt: string;
  };
}
```

Include:
- Event envelope structure
- Versioning strategy
- Required vs optional fields
- Schema evolution guidelines

### Step 5: Producer Implementation

Provide producer code:

**Node.js (KafkaJS):**
```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:19092'],
});

const producer = kafka.producer();

async function publishEvent(topic: string, event: any) {
  await producer.connect();
  await producer.send({
    topic,
    messages: [
      {
        key: event.data.taskId,
        value: JSON.stringify(event),
        headers: {
          'event-type': event.eventType,
        },
      },
    ],
  });
}
```

**Python (aiokafka):**
```python
from aiokafka import AIOKafkaProducer
import json

producer = AIOKafkaProducer(
    bootstrap_servers='localhost:19092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

async def publish_event(topic: str, event: dict):
    await producer.start()
    try:
        await producer.send_and_wait(
            topic,
            value=event,
            key=event['data']['taskId'].encode('utf-8')
        )
    finally:
        await producer.stop()
```

### Step 6: Consumer Implementation

Provide consumer code with:
- Consumer group configuration
- Message processing logic
- Error handling and retry strategy
- Offset management

### Step 7: Testing and Monitoring

Include:
- Unit tests for producers/consumers
- Integration tests
- Monitoring commands (rpk topic consume, etc.)
- Lag monitoring setup

## ACCEPTANCE CRITERIA

- Kafka/Redpanda is properly configured and running
- Topics are created with appropriate partitions and retention
- Event schemas are well-defined and versioned
- Producers successfully publish events
- Consumers successfully process events
- Error handling and retry logic is implemented
- Code includes proper connection lifecycle management
- Documentation covers schema evolution strategy
