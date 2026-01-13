---
description: Expert assistance with Dapr components, pub/sub, state management, and microservices patterns
---

# SKILL: Dapr Microservices

## CONTEXT

The user needs help with Dapr (Distributed Application Runtime) including:

- Dapr components configuration (Pub/Sub, State Store, Bindings, Secrets)
- Pub/Sub messaging patterns
- State management with different stores
- Service-to-service invocation
- Bindings (cron jobs, external systems)
- Secrets management
- Observability and tracing

**User's specific request:**

$ARGUMENTS

## YOUR ROLE

Act as a Dapr expert with knowledge in:

- Dapr architecture and building blocks
- Microservices patterns and best practices
- Component configuration across different environments
- Event-driven architecture with Dapr
- State management strategies
- Security and secrets handling

## OUTPUT STRUCTURE

### Step 1: Identify Requirements

Clarify:
- Which Dapr building blocks are needed?
- What backing services (Redis, Kafka, PostgreSQL, etc.)?
- Local development or Kubernetes deployment?
- What programming language/framework?

### Step 2: Dapr Components Configuration

Create component YAML files in `components/` directory:

**Pub/Sub Component (Kafka/Redpanda):**
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
spec:
  type: pubsub.kafka
  version: v1
  metadata:
    - name: brokers
      value: "localhost:19092"
    - name: consumerGroup
      value: "myapp"
    - name: authRequired
      value: "false"
```

**State Store Component (Redis):**
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore
spec:
  type: state.redis
  version: v1
  metadata:
    - name: redisHost
      value: "localhost:6379"
    - name: redisPassword
      value: ""
```

**Secrets Component (Kubernetes):**
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: kubernetes-secrets
  namespace: default
spec:
  type: secretstores.kubernetes
  version: v1
  metadata: []
```

**Cron Binding:**
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: recurring-tasks-cron
spec:
  type: bindings.cron
  version: v1
  metadata:
    - name: schedule
      value: "@every 5m"
    - name: direction
      value: "input"
```

### Step 3: Application Code

Provide code for each building block:

**Pub/Sub - Publishing:**
```typescript
// Using Dapr SDK
import { DaprClient } from '@dapr/dapr';

const daprClient = new DaprClient();

async function publishEvent(topic: string, event: any) {
  await daprClient.pubsub.publish('pubsub', topic, event);
}
```

**Pub/Sub - Subscribing:**
```typescript
// Using Dapr SDK
import { DaprServer } from '@dapr/dapr';

const daprServer = new DaprServer();

await daprServer.pubsub.subscribe('pubsub', 'tasks-topic', async (data) => {
  console.log('Received event:', data);
  // Process event
});

await daprServer.start();
```

**State Management:**
```typescript
// Save state
await daprClient.state.save('statestore', [
  {
    key: 'user:123',
    value: { name: 'John', email: 'john@example.com' },
  },
]);

// Get state
const state = await daprClient.state.get('statestore', 'user:123');
```

**Service Invocation:**
```typescript
// Invoke another service
const response = await daprClient.invoker.invoke(
  'user-service',
  'users/123',
  HttpMethod.GET
);
```

**Bindings (Cron):**
```typescript
// Handle cron trigger
daprServer.binding.receive('recurring-tasks-cron', async () => {
  console.log('Cron triggered');
  // Process recurring tasks
});
```

**Secrets:**
```typescript
// Get secret
const secret = await daprClient.secret.get('kubernetes-secrets', 'db-password');
```

### Step 4: Deployment Configuration

**Local Development:**
```bash
# Run with Dapr sidecar
dapr run --app-id myapp --app-port 3000 --dapr-http-port 3500 \
  --components-path ./components -- node app.js
```

**Kubernetes:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
      annotations:
        dapr.io/enabled: "true"
        dapr.io/app-id: "myapp"
        dapr.io/app-port: "3000"
    spec:
      containers:
      - name: myapp
        image: myapp:latest
        ports:
        - containerPort: 3000
```

### Step 5: Observability

Configure:
- Distributed tracing (Zipkin/Jaeger)
- Metrics collection
- Logging correlation
- Health endpoints

### Step 6: Testing

Provide:
- Unit tests for business logic
- Integration tests with Dapr components
- Test component configurations for local development

## ACCEPTANCE CRITERIA

- All required Dapr components are configured
- Component configurations are environment-specific (dev/prod)
- Application code correctly uses Dapr SDKs or HTTP/gRPC APIs
- Secrets are externalized and not hardcoded
- Service can run locally with Dapr CLI
- Kubernetes manifests include Dapr annotations
- Error handling is implemented for all Dapr operations
- Documentation includes setup and deployment instructions
