# Research: Lead Management with AI Qualification (Kubernetes Architecture)

**Feature**: Lead CRUD with AI Scoring (001-lead-crud-ai)
**Phase**: 0 - Technology Decisions
**Date**: 2025-12-31
**Architecture**: Kubernetes Microservices

**Note**: This research document reflects the **Kubernetes-based architecture** decision documented in [ADR 0001](../../history/adr/0001-kubernetes-over-serverless.md). For AWS serverless research, see `research-aws-serverless.md` (archived).

---

## Architecture Decision: Kubernetes Over AWS Serverless

**Decision**: Use DigitalOcean Kubernetes (DOKS) + Redpanda + Dapr instead of AWS Lambda + SNS/SQS

**Rationale**:
- **Cost**: 40% savings ($161/month vs $350/month at 10K leads)
- **Portability**: Avoid AWS vendor lock-in, can migrate to any cloud
- **Team Skills**: Leverage existing Kubernetes/Docker expertise (see `.claude/skills/`)
- **Local Dev**: Minikube provides true local Kubernetes environment vs complex LocalStack
- **Event Streaming**: Kafka supports advanced patterns (event sourcing, CQRS) vs limited SNS/SQS

See [ADR 0001](../../history/adr/0001-kubernetes-over-serverless.md) for full justification.

---

## Technology Stack Selection

### Container Runtime: Docker + Kubernetes

**Decision**: Docker containers orchestrated by Kubernetes (DOKS for production, Minikube for local)

**Rationale**:
- **Docker**: Industry-standard containerization, portable across environments
- **Kubernetes**: De facto container orchestration standard, cloud-agnostic
- **DOKS**: Managed Kubernetes ($161/month), simpler than self-hosted
- **Minikube**: Free local Kubernetes cluster for development

**Reference Skill**: `.claude/skills/kubernetes-deployment.md`

**Best Practices** (from skill):
- Multi-stage Dockerfiles for smaller image sizes
- Resource limits/requests to prevent resource contention
- Liveness/readiness probes for health checking
- Horizontal Pod Autoscaling for traffic spikes

**Example Dockerfile** (Backend API):
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8000
CMD ["node", "dist/main.js"]
```

**Alternatives Considered**:
- **AWS Lambda**: Higher cost, vendor lock-in, cold start issues
- **Google Cloud Run**: Similar to Lambda, still vendor lock-in
- **Self-hosted VMs**: Higher operational burden

---

### Event Messaging: Redpanda Cloud (Kafka API)

**Decision**: Redpanda Cloud (serverless) for event streaming with Kafka API

**Rationale**:
- **Kafka API**: Industry standard, rich ecosystem, advanced features
- **Redpanda**: Kafka-compatible, simpler than Apache Kafka, S3-compatible storage
- **Serverless Tier**: FREE for up to 10GB storage, 10MB/s throughput (perfect for MVP)
- **No ZooKeeper**: Redpanda eliminates ZooKeeper complexity

**Reference Skill**: `.claude/skills/kafka-redpanda.md`

**Topics Design**:
| Topic | Partitions | Retention | Purpose |
|-------|------------|-----------|---------|
| `lead-events` | 3 | 7 days | Lead CRUD operations (created, updated, deleted) |
| `notifications` | 3 | 3 days | Email/WhatsApp notification triggers |
| `follow-up-events` | 3 | 30 days | Scheduled follow-up tasks |
| `ai-qualification` | 3 | 7 days | AI scoring results for analytics |

**Event Schema Example** (from skill):
```typescript
interface LeadCreatedEvent {
  eventId: string;          // UUID for idempotency
  eventType: 'lead.created';
  timestamp: string;        // ISO 8601
  version: '1.0';          // Schema version
  data: {
    leadId: string;
    name: string;
    email: string;
    leadSource: string;
  };
}
```

**Producer Pattern** (KafkaJS):
```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'leadflow-backend',
  brokers: ['seed-xxx.cloud.redpanda.com:9092'],
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.REDPANDA_USERNAME,
    password: process.env.REDPANDA_PASSWORD,
  },
  ssl: true,
});

const producer = kafka.producer();
await producer.send({
  topic: 'lead-events',
  messages: [{
    key: leadId,
    value: JSON.stringify(event),
  }],
});
```

**Consumer Pattern** (Dapr Pub/Sub - see next section):
Consumers use Dapr Pub/Sub abstraction instead of direct KafkaJS for portability.

**Alternatives Considered**:
- **AWS SNS/SQS**: Limited to simple pub/sub, no stream processing, vendor lock-in
- **RabbitMQ**: Good for queuing but lacks Kafka's log-based architecture
- **Apache Kafka (self-hosted)**: Requires managing ZooKeeper and brokers

---

### Distributed Application Runtime: Dapr

**Decision**: Dapr for infrastructure abstraction (pub/sub, state, secrets, service invocation)

**Rationale**:
- **Portability**: Swap infrastructure without code changes (Kafka → RabbitMQ, Redis → PostgreSQL)
- **Polyglot**: Supports multiple languages (TypeScript now, Python/Go later)
- **Sidecar Pattern**: Non-invasive observability, retries, circuit breaker
- **Kubernetes-Native**: Integrates seamlessly with DOKS and Minikube

**Reference Skill**: `.claude/skills/dapr-microservices.md`

**Dapr Components Configuration**:

**1. Pub/Sub (Redpanda/Kafka)**:
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
      value: "seed-xxx.cloud.redpanda.com:9092"
    - name: authType
      value: "password"
    - name: saslUsername
      secretKeyRef:
        name: kafka-secret
        key: username
    - name: saslPassword
      secretKeyRef:
        name: kafka-secret
        key: password
    - name: consumerGroup
      value: "leadflow-group"
```

**2. State Store (Redis)**:
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
      value: "redis:6379"
    - name: redisPassword
      secretKeyRef:
        name: redis-secret
        key: password
```

**3. Cron Binding (Follow-ups)**:
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: followup-cron
spec:
  type: bindings.cron
  version: v1
  metadata:
    - name: schedule
      value: "*/5 * * * *"  # Every 5 minutes
```

**Backend Code Using Dapr** (from skill):
```typescript
import { DaprClient } from '@dapr/dapr';

const daprClient = new DaprClient();

// Publish event
await daprClient.pubsub.publish('pubsub', 'lead-events', {
  eventType: 'lead.created',
  leadId: lead.id,
  ...leadData
});

// Save state
await daprClient.state.save('statestore', [
  { key: `lead:${leadId}`, value: lead }
]);

// Get secret
const apiKey = await daprClient.secret.get('kubernetes-secrets', 'CLAUDE_API_KEY');
```

**Notification Service Consumer** (from skill):
```typescript
import { DaprServer } from '@dapr/dapr';

const daprServer = new DaprServer();

// Subscribe to notifications topic
await daprServer.pubsub.subscribe('pubsub', 'notifications', async (data) => {
  await sendEmail(data.email, data.message);
  await sendWhatsApp(data.phone, data.message);
});

await daprServer.start();
```

**Alternatives Considered**:
- **Direct SDKs** (KafkaJS, ioredis): Tightly coupled, language-specific, harder to swap
- **Service Mesh** (Istio, Linkerd): Heavier weight, more complex for MVP

---

### Container Orchestration: DigitalOcean Kubernetes (DOKS)

**Decision**: DOKS for production, Minikube for local development

**Rationale**:
- **DOKS**: Managed control plane (free), simple setup, $200 credit for 60 days
- **Cost**: $161/month for 3-node cluster (s-2vcpu-4gb) vs $350+ AWS
- **Minikube**: True local Kubernetes environment vs LocalStack complexity

**Reference Skill**: `.claude/skills/kubernetes-deployment.md`

**Cluster Configuration**:
```bash
# Create DOKS cluster
doctl kubernetes cluster create leadflow-prod \
  --region nyc1 \
  --version 1.28.2-do.0 \
  --count 3 \
  --size s-2vcpu-4gb
```

**Minikube Local Setup**:
```bash
# Start Minikube
minikube start --cpus=4 --memory=8192 --driver=docker

# Install Dapr
dapr init -k

# Enable Ingress
minikube addons enable ingress
```

**Deployment Manifest** (Backend API):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-api
  annotations:
    dapr.io/enabled: "true"
    dapr.io/app-id: "backend-api"
    dapr.io/app-port: "8000"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend-api
  template:
    spec:
      containers:
      - name: backend-api
        image: registry.digitalocean.com/leadflow-registry/backend:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8000
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 10
```

**Alternatives Considered**:
- **AWS EKS**: $73/month control plane + EC2 costs, AWS lock-in
- **GKE (Google)**: Similar pricing to EKS, vendor lock-in
- **Self-hosted K8s**: Free but high operational burden

---

### Package Management: Helm Charts

**Decision**: Helm for Kubernetes package management with environment-specific values

**Rationale**:
- **Templating**: Parameterize deployments for dev/staging/prod
- **Versioning**: Track chart versions for rollback
- **Dependencies**: Manage PostgreSQL, Redis via subcharts

**Reference Skill**: `.claude/skills/helm-charts.md`

**Chart Structure**:
```
helm/leadflow-ai/
├── Chart.yaml
├── values.yaml              # Default values
├── values-dev.yaml          # Minikube overrides
├── values-prod.yaml         # DOKS overrides
└── templates/
    ├── backend-deployment.yaml
    ├── backend-service.yaml
    ├── notification-deployment.yaml
    ├── followup-deployment.yaml
    ├── ingress.yaml
    └── _helpers.tpl
```

**values-dev.yaml** (Minikube):
```yaml
replicaCount: 1
image:
  tag: "latest"
ingress:
  enabled: true
  hosts:
    - host: leadflow.local
resources:
  limits:
    cpu: 200m
    memory: 256Mi
```

**values-prod.yaml** (DOKS):
```yaml
replicaCount: 3
image:
  tag: "v1.0.0"
ingress:
  enabled: true
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: api.leadflowai.com
  tls:
    - secretName: leadflow-tls
      hosts:
        - api.leadflowai.com
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi
```

**Deployment Commands**:
```bash
# Install to development
helm install leadflow ./helm/leadflow-ai -f ./helm/leadflow-ai/values-dev.yaml -n development

# Install to production
helm install leadflow ./helm/leadflow-ai -f ./helm/leadflow-ai/values-prod.yaml -n production

# Upgrade
helm upgrade leadflow ./helm/leadflow-ai -f values-prod.yaml -n production

# Rollback
helm rollback leadflow 1 -n production
```

**Alternatives Considered**:
- **Kustomize**: Less powerful templating than Helm
- **Raw YAML**: No parameterization, hard to manage multi-environment

---

## Database & State Management

### PostgreSQL: Neon DB (Serverless)

**Decision**: Neon DB for serverless PostgreSQL (unchanged from AWS plan)

**Rationale**:
- **Serverless**: Auto-scaling, pay-per-use
- **Free Tier**: 3GB storage, 100 hours compute/month
- **Branching**: Git-like database branches for testing
- **Global**: CDN-backed for low latency

**Connection** (same as AWS RDS):
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Connection pool size
});
```

### Redis: Dapr State Store

**Decision**: Redis via Dapr State Store abstraction (not ElastiCache)

**Rationale**:
- **Dapr Portability**: Can swap Redis → PostgreSQL state store without code changes
- **Kubernetes-Native**: Deploy Redis via Helm chart (bitnami/redis)
- **Cost**: Self-hosted in DOKS vs AWS ElastiCache fees

**Dapr State API** (from skill):
```typescript
// Save state
await daprClient.state.save('statestore', [
  { key: `lead:${leadId}`, value: lead, etag: '1' }
]);

// Get state
const state = await daprClient.state.get('statestore', `lead:${leadId}`);

// Delete state
await daprClient.state.delete('statestore', `lead:${leadId}`);
```

---

## Observability: Prometheus + Grafana

**Decision**: kube-prometheus-stack for metrics, Grafana for dashboards

**Rationale**:
- **Kubernetes-Native**: Prometheus scrapes pods automatically
- **Grafana Dashboards**: Pre-built K8s dashboards
- **Cost**: Free (self-hosted) vs AWS CloudWatch fees

**Reference Skill**: `.claude/skills/observability-monitoring.md`

**Installation**:
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

**Custom Metrics** (Backend API):
```typescript
import prom from 'prom-client';

const register = new prom.Registry();

const leadCreatedCounter = new prom.Counter({
  name: 'lead_created_total',
  help: 'Total leads created',
  labelNames: ['source'],
  registers: [register],
});

// Increment on lead creation
leadCreatedCounter.inc({ source: 'website' });

// Expose /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Alternatives Considered**:
- **AWS X-Ray + CloudWatch**: Vendor lock-in, higher cost
- **Datadog**: $15/host/month, expensive at scale

---

## CI/CD: GitHub Actions

**Decision**: GitHub Actions for CI/CD with automated DOKS deployment

**Rationale**:
- **Free**: 2000 minutes/month for private repos
- **Native**: Built into GitHub, no external service
- **DOKS Integration**: doctl CLI for deployment

**Reference Skill**: `.claude/skills/ci-cd-github-actions.md`

**Workflow**:
```yaml
name: Deploy to DOKS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t registry.digitalocean.com/leadflow-registry/backend:${{ github.sha }} ./backend

      - name: Push to DO Registry
        run: |
          doctl registry login
          docker push registry.digitalocean.com/leadflow-registry/backend:${{ github.sha }}

      - name: Deploy with Helm
        run: |
          doctl kubernetes cluster kubeconfig save leadflow-prod
          helm upgrade --install leadflow ./helm/leadflow-ai \
            --set image.tag=${{ github.sha }} \
            --wait
```

**Alternatives Considered**:
- **AWS CodePipeline**: Vendor lock-in, more complex setup
- **GitLab CI**: Requires GitLab, not GitHub-native

---

## Cost Estimation (Kubernetes Architecture)

### Monthly Cost Breakdown (10,000 active leads, 100 qualifications/day)

**DigitalOcean Services**:
- **DOKS**: 3 nodes × s-2vcpu-4gb @ $48/node = **$144/month**
- **Load Balancer**: **$12/month**
- **Container Registry**: **$5/month** (Basic tier)
- **DO Subtotal**: **$161/month**

**External Services**:
- **Redpanda Cloud**: **$0/month** (free serverless tier, 10GB storage)
  - Paid tier: $99/month for production workloads
- **Neon DB**: **$0/month** (free tier, 3GB storage)
  - Paid tier: $19/month (Pro, 10GB storage)
- **Claude API**: 100 qualifications/day × 30 days = 3000 requests
  - Input: 500 tokens/request × 3000 = 1.5M tokens × $3/MTok = $4.50
  - Output: 200 tokens/request × 3000 = 600K tokens × $15/MTok = $9.00
  - **Claude Subtotal**: **$14/month**

**External Subtotal**: **$14-132/month** (depending on Redpanda/Neon tiers)

**Total**: **$175-293/month**

### Comparison to AWS Serverless

| Service | AWS Serverless | Kubernetes (DOKS) | Savings |
|---------|----------------|-------------------|---------|
| Compute | Lambda: $50/month | DOKS: $144/month | -$94 |
| Messaging | SNS/SQS: $25/month | Redpanda: $0-99/month | $25-(-74) |
| Database | RDS: $85/month | Neon DB: $0-19/month | $85-66 |
| Cache | ElastiCache: $50/month | Self-hosted Redis: $0 | $50 |
| Observability | CloudWatch: $25/month | Prometheus: $0 | $25 |
| API Gateway | $15/month | Ingress: $0 | $15 |
| **TOTAL** | **$250-350/month** | **$175-293/month** | **$57-75** (20-30% savings at MVP scale) |

**At 10K leads scale**: AWS ~$350/month vs DOKS ~$293/month = **16% savings**

**With DigitalOcean $200 credit**: First **60 days FREE**!

---

## Deployment Phases

### Phase 1: Local Development (Minikube)
1. Start Minikube with Dapr
2. Deploy Redpanda via Docker Compose
3. Install backend via Helm (values-dev.yaml)
4. Test with port-forward

### Phase 2: DOKS Production
1. Create DOKS cluster
2. Install Dapr on DOKS
3. Create Redpanda Cloud cluster
4. Deploy via Helm (values-prod.yaml)
5. Configure DNS and TLS

### Phase 3: CI/CD Automation
1. GitHub Actions workflow
2. Automated testing
3. Container registry push
4. Helm upgrade on DOKS

---

## Conclusion

This research establishes technology decisions for **Kubernetes-based microservices architecture** with:

✅ **DigitalOcean Kubernetes (DOKS)** - $161/month, vendor-agnostic
✅ **Redpanda Cloud** - Free tier, Kafka API, event streaming
✅ **Dapr** - Infrastructure abstraction, polyglot, sidecar pattern
✅ **Helm Charts** - Parameterized deployments, multi-environment
✅ **Neon DB** - Serverless PostgreSQL, free tier
✅ **Prometheus + Grafana** - Free observability vs AWS CloudWatch
✅ **GitHub Actions** - Free CI/CD, DOKS integration

**Key Benefits Over AWS Serverless**:
- **16-30% cost savings** at scale
- **Vendor portability** (can migrate to any cloud)
- **Team skills alignment** (leverage existing Kubernetes expertise)
- **Better local development** (Minikube vs LocalStack)

**Trade-offs**:
- Higher operational complexity (managing Kubernetes)
- No auto-scaling for compute (need HPA configuration)
- More infrastructure to monitor (pods, nodes, services)

**Mitigation**: Leverage existing skills (`.claude/skills/`) and managed services (DOKS, Neon DB, Redpanda Cloud).

**Next Steps**: Proceed to Phase 1 (data-model.md, contracts/, quickstart.md) with Kubernetes context.
