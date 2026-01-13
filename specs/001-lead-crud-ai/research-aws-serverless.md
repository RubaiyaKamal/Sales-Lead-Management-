# Research: Lead Management with AI Qualification

**Feature**: Lead CRUD with AI Scoring (001-lead-crud-ai)
**Phase**: 0 - Technology Decisions
**Date**: 2025-12-31

## Technology Stack Selection

### Backend Runtime: Node.js 20 on AWS Lambda

**Decision**: TypeScript 5.3+ with Node.js 20 runtime for all Lambda functions

**Rationale**:
- **Serverless-native**: Node.js 20 is fully supported by AWS Lambda with optimized cold start times (< 500ms)
- **Type safety**: TypeScript provides compile-time type checking, reducing runtime errors in serverless environments where debugging is harder
- **Ecosystem**: Rich npm ecosystem for AWS SDK v3, Anthropic SDK, PostgreSQL/Redis clients
- **Team alignment**: Single language across backend and infrastructure (AWS CDK in TypeScript)

**Alternatives Considered**:
- **Python 3.11**: Better for data science but slower cold starts (700ms+), less type-safe
- **Go 1.21**: Fastest cold starts (< 100ms) but steeper learning curve, less ecosystem for AI SDKs

**Best Practices**:
- Use ES modules (`"type": "module"` in package.json) for better tree-shaking and smaller bundle sizes
- Enable `strict: true` in tsconfig.json for maximum type safety
- Use esbuild for bundling Lambda functions (10x faster than webpack)
- Configure Lambda reserved concurrency to prevent cost overruns during traffic spikes

---

### API Framework: Express.js with serverless-http

**Decision**: Express.js 4.x wrapped with `serverless-http` for AWS Lambda/API Gateway integration

**Rationale**:
- **Familiarity**: Express.js is the de facto Node.js web framework with extensive documentation
- **Middleware ecosystem**: Robust middleware for auth (passport, jsonwebtoken), validation (express-validator), CORS, compression
- **Serverless adapter**: `serverless-http` provides seamless translation between API Gateway events and Express request/response objects
- **Testability**: Supertest enables easy integration testing without deploying to AWS

**Alternatives Considered**:
- **Fastify**: 2x faster than Express but less mature ecosystem for serverless
- **Native Lambda handlers**: More AWS-native but requires custom routing logic, no middleware reuse

**Best Practices**:
- Use async/await with express-async-handler to avoid unhandled promise rejections
- Structure routes by resource (`/api/v1/leads`) with separate handler files
- Implement centralized error handling middleware to return consistent error responses
- Use helmet.js for security headers (CSP, HSTS, X-Frame-Options)

```typescript
// Example serverless Express setup
import express from 'express';
import serverless from 'serverless-http';
import { createLeadHandler } from './handlers/createLead';

const app = express();
app.use(express.json());
app.post('/api/v1/leads', createLeadHandler);

export const handler = serverless(app, {
  request: (request, event, context) => {
    request.context = context; // Attach Lambda context for tracing
  }
});
```

---

### Database: PostgreSQL 15 on AWS RDS

**Decision**: AWS RDS PostgreSQL 15 with Multi-AZ deployment for production

**Rationale**:
- **ACID compliance**: Critical for lead data consistency (no duplicate emails, cascade deletes)
- **JSON support**: Native JSONB for `metadata` field (custom lead attributes without schema changes)
- **Performance**: Indexes on email (uniqueness), status, assigned_to, created_at for fast filtering/sorting
- **Managed service**: RDS handles backups, patching, scaling, meeting Constitution RTO/RPO requirements

**Schema Design**:
- **leads table**: Core entity with UUID primary key, unique email constraint, indexes on frequently queried fields
- **lead_scores table**: Historical BANT scoring with foreign key to leads, one-to-many relationship
- **users table**: Sales team members with Cognito sub for auth mapping
- **activity_logs table**: Audit trail with JSON metadata for changed fields

**Alternatives Considered**:
- **DynamoDB**: Lower cost but eventual consistency breaks email uniqueness requirement
- **Aurora Serverless v2**: Higher cost ($43/month minimum vs RDS $25/month for dev), overkill for 10K leads

**Best Practices**:
- Use connection pooling with `pg` library (max 100 connections to prevent RDS CPU saturation)
- Parameterized queries ONLY (prevent SQL injection per Constitution IV)
- Composite indexes for common filters: `(status, created_at DESC)`, `(assigned_to, status)`
- CHECK constraints for score validation (0-25 range), status/qualification_status enums

```sql
-- Example index strategy
CREATE INDEX idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX idx_leads_assigned_status ON leads(assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE UNIQUE INDEX idx_leads_email ON leads(email);
```

---

### Caching: Redis 7 on AWS ElastiCache

**Decision**: AWS ElastiCache for Redis 7.x (cluster mode disabled) with 5-minute TTL for lead lists

**Rationale**:
- **Sub-millisecond latency**: Reduces database load for frequently accessed lead lists (SC-007: 70% cache hit rate target)
- **String + JSON storage**: Cache entire lead objects and paginated list responses
- **Atomic operations**: SETEX for automatic expiration, DEL for cache invalidation on mutations
- **Managed service**: ElastiCache handles replication, failover, backups

**Caching Strategy**:
- **Cache keys**: `leads:list:{filtersHash}` for paginated lists, `leads:detail:{leadId}` for individual leads
- **TTL**: 5 minutes for lists (acceptable staleness per spec assumptions), 60 seconds for individual leads
- **Invalidation**: On lead CREATE/UPDATE/DELETE, invalidate all list caches and specific detail cache

**Alternatives Considered**:
- **DynamoDB DAX**: Requires DynamoDB as primary database (rejected)
- **API Gateway caching**: Less flexible, no programmatic invalidation

**Best Practices**:
- Use ioredis library with built-in reconnection logic and cluster support
- Hash filter parameters (status, assigned_to, search) to create deterministic cache keys
- Implement cache-aside pattern: check cache first, query DB on miss, populate cache
- Monitor cache hit rate via CloudWatch custom metrics

```typescript
// Example cache key generation
import crypto from 'crypto';

function getCacheKey(filters: LeadFilters): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(filters))
    .digest('hex')
    .substring(0, 16);
  return `leads:list:${hash}`;
}
```

---

### AI Integration: Anthropic Claude API (Sonnet 4)

**Decision**: Anthropic Claude API (claude-sonnet-4) for BANT qualification with structured output

**Rationale**:
- **Structured responses**: Claude's tool use feature returns validated JSON with exact BANT score schema
- **Context window**: 200K tokens enables passing full lead history and conversation for re-qualification
- **Accuracy**: Claude Sonnet 4 balances cost ($3/MTok input, $15/MTok output) and accuracy (85% target per SC-006)
- **SDK**: Official @anthropic-ai/sdk with TypeScript support and error handling

**Prompt Strategy**:
- **System prompt**: Versioned in configuration (not hardcoded), defines BANT scoring rubric with examples
- **User message**: Combines lead data (company, metadata) with qualification questions/answers
- **Tool definition**: Structured schema for `qualify_lead` tool requiring budget_score, authority_score, need_score, timeline_score (0-25), reasoning, confidence (0.0-1.0)

**Error Handling**:
- **Retry logic**: Exponential backoff with jitter (1s, 2s, 4s) for rate limits (429) and transient errors (5xx)
- **Queue fallback**: If all retries fail, publish message to SQS for async processing (FR-020)
- **Token tracking**: Log input/output tokens to CloudWatch for cost monitoring (FR-021)

**Alternatives Considered**:
- **OpenAI GPT-4**: Similar accuracy but higher cost ($10/MTok input, $30/MTok output)
- **Self-hosted Llama 3**: Lower cost but requires EC2/ECS (violates Constitution I)

**Best Practices**:
- Store Claude API key in AWS Secrets Manager with automatic rotation
- Set max_tokens to 500 (BANT response is ~200 tokens) to prevent cost overruns
- Use temperature=0 for consistent scoring (reduce randomness)
- Implement circuit breaker: if API error rate > 50% in 5min window, disable AI qualification and alert on-call

```typescript
// Example Claude API integration
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: await getSecretValue('CLAUDE_API_KEY')
});

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 500,
  temperature: 0,
  system: BANT_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: leadContext }],
  tools: [QUALIFY_LEAD_TOOL]
});
```

---

### Event Messaging: AWS SNS + SQS

**Decision**: SNS for fan-out notifications, SQS for async processing and retries

**Rationale**:
- **Event-driven architecture**: SNS publishes `lead.created`, `lead.updated`, `lead.qualified` events to multiple subscribers (notifications, analytics, webhooks)
- **Guaranteed delivery**: SQS provides at-least-once delivery with visibility timeout for message processing
- **Decoupling**: Producers publish to SNS without knowing consumers, enabling independent service evolution
- **Dead Letter Queue**: Failed AI qualifications move to DLQ for manual investigation

**Event Schema**:
- **Envelope**: All events follow standard format: `{ eventId, eventType, timestamp, source, data, metadata }`
- **Versioning**: Include `schemaVersion: "1.0"` to support backward-compatible schema evolution
- **Payload**: Include only essential fields (lead ID, changed fields) to minimize message size

**Topic/Queue Design**:
- **Topics**: `lead-events` (fan-out to analytics, notifications, webhooks)
- **Queues**: `ai-processing-queue` (retry logic for failed Claude API calls), `ai-processing-dlq` (manual investigation after 3 retries)

**Alternatives Considered**:
- **EventBridge**: More powerful filtering but higher cost ($1/million events vs SNS $0.50/million)
- **Kinesis**: Overkill for 100 msgs/sec throughput requirement

**Best Practices**:
- Set SQS visibility timeout to 30 seconds (max AI qualification time is 3s, allows retries)
- Configure DLQ redrive policy: maxReceiveCount=3 (fail after 3 attempts)
- Use SNS message attributes for filtering (e.g., `qualification_status: "qualified"` for high-value lead alerts)
- Implement idempotency: deduplicate messages using `eventId` in DynamoDB or Redis

```json
// Example SNS event payload
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "lead.qualified",
  "timestamp": "2025-12-31T10:30:00Z",
  "source": "lead-service",
  "schemaVersion": "1.0",
  "data": {
    "leadId": "abc-123",
    "totalScore": 84,
    "qualificationStatus": "qualified",
    "assignedTo": "user-456"
  },
  "metadata": {
    "traceId": "1-67a2b3c4-5d6e7f8g9h0i1j2k3l4m5n6o"
  }
}
```

---

### Observability: AWS X-Ray + CloudWatch

**Decision**: X-Ray for distributed tracing, CloudWatch for metrics/logs/alarms

**Rationale**:
- **Tracing**: X-Ray captures end-to-end request flow (API Gateway → Lambda → RDS/Redis → Claude API) with subsegment timing
- **Metrics**: Custom CloudWatch metrics track business KPIs (LeadCreated, LeadQualified) and technical SLAs (OperationLatency)
- **Logs**: Structured JSON logging enables filtering by traceId, userId, leadId for debugging
- **Alarms**: CloudWatch alarms on error rate, latency p95, queue depth trigger SNS notifications to on-call

**Instrumentation Strategy**:
- **Lambda functions**: Enable X-Ray tracing in AWS CDK (`tracing: lambda.Tracing.ACTIVE`)
- **SDK calls**: AWS SDK v3 auto-instruments X-Ray subsegments for RDS, Redis, SNS/SQS
- **Custom subsegments**: Wrap Claude API calls in X-Ray subsegments to measure AI latency
- **Structured logging**: Use Pino logger with correlation IDs from Lambda context

**Metrics to Track** (per FR-035):
- `LeadCreated` (count, dimension: leadSource)
- `LeadQualified` (count, dimension: qualificationStatus)
- `AIQualificationTime` (milliseconds, p50/p95/p99)
- `LeadOperationLatency` (milliseconds, dimensions: operation [create/read/update/delete])

**Alternatives Considered**:
- **Datadog**: Richer features but $15/host/month cost exceeds budget
- **OpenTelemetry**: More portable but requires custom collector setup (complexity)

**Best Practices**:
- Set log retention to 30 days for INFO, 90 days for ERROR (per Constitution V)
- Create CloudWatch dashboard with lead funnel, AI performance, system health
- Configure alarms: API error rate > 1%, Lambda errors > 10/min, RDS CPU > 80%
- Use X-Ray sampling rules: 5% of successful requests, 100% of errors

```typescript
// Example structured logging
import pino from 'pino';

const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

logger.info({
  traceId: context.traceId,
  userId: event.requestContext.authorizer.claims.sub,
  leadId: leadId,
  operation: 'createLead',
  latency: 145,
  msg: 'Lead created successfully'
});
```

---

## Security Architecture

### Authentication: AWS Cognito with JWT

**Decision**: AWS Cognito User Pool with JWT tokens for authentication

**Rationale**:
- **Managed service**: Cognito handles user registration, password policies, MFA, token issuance/validation
- **JWT integration**: API Gateway can validate JWT tokens natively (no Lambda authorizer needed)
- **RBAC**: Store user roles (admin, manager, sales_rep) in Cognito custom attributes
- **Token refresh**: Cognito handles refresh token rotation automatically

**Token Flow**:
1. User authenticates with Cognito (email + password)
2. Cognito returns ID token (JWT) with user claims (sub, email, custom:role)
3. Client includes token in Authorization header: `Bearer <token>`
4. API Gateway validates token signature and expiration
5. Lambda receives decoded claims in `event.requestContext.authorizer.claims`

**Best Practices**:
- Set access token expiration to 1 hour (balance security and UX)
- Use httpOnly cookies for web clients (prevent XSS token theft)
- Implement token revocation via Cognito's GlobalSignOut API for compromised accounts
- Rotate Cognito User Pool signing keys annually

---

### Authorization: Role-Based Access Control (RBAC)

**Decision**: Custom RBAC middleware using Cognito custom:role attribute

**Role Hierarchy**:
- **admin**: Full access to all leads, can delete leads, manage users
- **manager**: Read/update leads assigned to their team, assign leads to team members
- **sales_rep**: Read/update only leads assigned to them, create new leads

**Enforcement** (per FR-013):
- **POST /leads**: All authenticated users (lead created with assigned_to = null)
- **GET /leads/:id**: Own leads (sales_rep), team leads (manager), all leads (admin)
- **PATCH /leads/:id**: Own leads (sales_rep), team leads (manager), all leads (admin)
- **DELETE /leads/:id**: Admin only
- **POST /leads/:id/qualify**: Own leads (sales_rep), team leads (manager), all leads (admin)

**Best Practices**:
- Store role in JWT claims to avoid database lookup on every request
- Implement middleware that checks role + ownership before handler execution
- Return 403 Forbidden (not 404) when user lacks permission to prevent information disclosure
- Audit all permission denials to CloudWatch for security monitoring

```typescript
// Example RBAC middleware
export function requireRole(...allowedRoles: string[]) {
  return (req, res, next) => {
    const userRole = req.user.role; // from JWT claims
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Usage
app.delete('/api/v1/leads/:id', requireRole('admin'), deleteLeadHandler);
```

---

### Data Encryption: KMS + TLS

**Decision**: AWS KMS for at-rest encryption, TLS 1.3 for in-transit encryption

**At-Rest Encryption**:
- **RDS**: Enable encryption using AWS-managed KMS key (free, auto-rotated annually)
- **ElastiCache**: Enable encryption at rest + in-transit encryption
- **S3**: Enable default encryption for archival bucket (90-day inactive leads)
- **PII fields**: Additional application-level encryption for email/phone using KMS envelope encryption (optional, evaluate based on compliance requirements)

**In-Transit Encryption**:
- **API Gateway**: TLS 1.3 with AWS-managed certificate (ACM)
- **RDS/Redis**: Force SSL connections from Lambda functions
- **Claude API**: HTTPS only (enforced by Anthropic SDK)

**Best Practices**:
- Use customer-managed KMS keys for production (audit via CloudTrail)
- Rotate KMS keys annually via automated process
- Disable insecure cipher suites (TLS 1.0, TLS 1.1)
- Implement certificate pinning for mobile apps (future Phase 2)

---

## Performance Optimization

### Database Query Optimization

**Strategies**:
1. **Indexes**: Composite indexes on common filters (status + created_at, assigned_to + status)
2. **Pagination**: Use cursor-based pagination for large result sets (more efficient than OFFSET)
3. **Connection pooling**: Reuse connections across Lambda invocations (pg connection pool)
4. **Read replicas**: Offload analytics queries to RDS read replica (future optimization)

**Query Patterns**:
```sql
-- Efficient list query with pagination and filtering
SELECT id, name, email, company, status, lead_score, created_at
FROM leads
WHERE status = $1 AND assigned_to = $2
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- Cursor-based pagination (more efficient for large datasets)
SELECT id, name, email, company, status, lead_score, created_at
FROM leads
WHERE status = $1 AND created_at < $2
ORDER BY created_at DESC
LIMIT 20;
```

**Best Practices**:
- Use EXPLAIN ANALYZE to verify index usage before deploying queries
- Set statement timeout to 5 seconds to prevent long-running queries
- Monitor slow query log in CloudWatch (queries > 1 second)
- Implement count caching for pagination total (cache counts for 5 minutes)

---

### Lambda Optimization

**Strategies**:
1. **Cold start reduction**: Use provisioned concurrency for frequently called functions (POST /leads, GET /leads)
2. **Memory tuning**: Profile functions to find optimal memory (CPU scales with memory in Lambda)
3. **Bundle optimization**: Use esbuild to remove unused code, reduce bundle size to < 1MB
4. **Connection reuse**: Initialize database/Redis connections outside handler (reuse across warm invocations)

**Example Lambda Configuration**:
```typescript
// CDK stack configuration
const createLeadFunction = new lambda.Function(this, 'CreateLead', {
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 512, // Tuned via profiling (256MB too slow, 1024MB wasted)
  timeout: Duration.seconds(10),
  reservedConcurrentExecutions: 10, // Prevent cost overruns
  tracing: lambda.Tracing.ACTIVE,
  environment: {
    DB_HOST: db.clusterEndpoint.hostname,
    REDIS_HOST: redis.attrRedisEndpointAddress
  }
});

// Provisioned concurrency for low latency
createLeadFunction.addAlias('live', {
  provisionedConcurrentExecutions: 2 // Keep 2 warm instances
});
```

**Best Practices**:
- Initialize SDK clients outside handler for connection reuse
- Use Lambda layers for shared dependencies (AWS SDK, Anthropic SDK)
- Monitor Lambda duration, memory usage, cold starts in CloudWatch
- Set reserved concurrency to prevent runaway costs during traffic spikes

---

## Testing Strategy

### Unit Tests (Jest)

**Scope**: Business logic in services, models, validators (target: 90% coverage per Constitution VI)

**Tools**: Jest (test runner), ts-jest (TypeScript support), AWS SDK mocks (@aws-sdk/client-mock)

**Patterns**:
- Mock external dependencies (database, Redis, Claude API, SNS/SQS)
- Test edge cases (invalid email, duplicate lead, API errors)
- Test BANT scoring logic with various score combinations

```typescript
// Example unit test
import { LeadService } from '../services/LeadService';
import { mockClient } from 'aws-sdk-client-mock';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsMock = mockClient(SNSClient);

describe('LeadService', () => {
  beforeEach(() => {
    snsMock.reset();
  });

  it('should publish lead.created event on successful creation', async () => {
    snsMock.on(PublishCommand).resolves({ MessageId: 'msg-123' });

    const lead = await leadService.createLead({ name: 'John', email: 'john@example.com' });

    expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
      Message: expect.stringContaining('lead.created')
    });
  });
});
```

---

### Integration Tests (Supertest + Testcontainers)

**Scope**: API endpoints with real database, event flows (target: 80% overall coverage)

**Tools**: Supertest (HTTP assertions), Testcontainers (PostgreSQL, Redis), AWS SDK mocks

**Setup**:
- Spin up PostgreSQL/Redis in Docker containers via Testcontainers
- Run database migrations before tests
- Seed test data (users, leads) for consistent test state
- Clean up after each test to prevent leakage

```typescript
// Example integration test
import request from 'supertest';
import { app } from '../app';

describe('POST /api/v1/leads', () => {
  it('should return 400 for duplicate email', async () => {
    await request(app)
      .post('/api/v1/leads')
      .send({ name: 'John', email: 'john@example.com', leadSource: 'website' })
      .expect(201);

    const response = await request(app)
      .post('/api/v1/leads')
      .send({ name: 'Jane', email: 'john@example.com', leadSource: 'referral' })
      .expect(400);

    expect(response.body.error.message).toContain('Email already exists');
  });
});
```

---

### Contract Tests (OpenAPI Validation)

**Scope**: Validate API responses match OpenAPI specification

**Tools**: openapi-validator, Ajv (JSON schema validation)

**Process**:
1. Define OpenAPI spec in `contracts/leads-api.openapi.yaml`
2. Generate TypeScript types from spec
3. Validate every API response against spec in tests
4. Fail build if responses don't match contract

---

## Cost Estimation

### Monthly Cost Breakdown (1000 active leads, 100 qualifications/day)

**AWS Services**:
- Lambda: 100K invocations/month, 512MB, 200ms avg = $5
- RDS PostgreSQL: db.t4g.micro (1 vCPU, 1GB RAM) = $25
- ElastiCache Redis: cache.t4g.micro (1 vCPU, 1GB RAM) = $15
- API Gateway: 100K requests/month = $0.35
- SNS: 10K messages/month = $0.005
- SQS: 5K messages/month = $0.002
- S3: 10GB archival storage (Glacier) = $0.04
- CloudWatch: Logs (5GB/month), Metrics (50 custom) = $15
- Data Transfer: 10GB/month = $5
- **AWS Subtotal**: ~$65/month

**External Services**:
- Claude API: 100 qualifications/day × 30 days = 3000 requests
  - Input: 500 tokens/request × 3000 = 1.5M tokens × $3/MTok = $4.50
  - Output: 200 tokens/request × 3000 = 600K tokens × $15/MTok = $9.00
- **Claude Subtotal**: ~$14/month

**Total**: $79/month (well below $385-685 budget)

**Scaling**: At 10,000 active leads, 1000 qualifications/day:
- Lambda: $50 (10x requests)
- RDS: $85 (db.t4g.small for CPU)
- Redis: $50 (cache.t4g.small for memory)
- Claude API: $140 (10x requests)
- Other: $25 (CloudWatch, data transfer)
- **Total at scale**: ~$350/month (within budget)

---

## Deployment Strategy

### Infrastructure as Code: AWS CDK

**Stack Separation**:
1. **VpcStack**: VPC, subnets, NAT gateway (shared across environments)
2. **DatabaseStack**: RDS PostgreSQL, ElastiCache Redis (depends on VpcStack)
3. **AuthStack**: Cognito User Pool, identity pool
4. **MessagingStack**: SNS topics, SQS queues
5. **ApiStack**: Lambda functions, API Gateway (depends on all above)
6. **MonitoringStack**: CloudWatch dashboards, alarms

**Rationale**: Separate stacks enable independent updates, faster deployments, easier rollback

**Best Practices**:
- Use CDK context for environment-specific config (dev, staging, prod)
- Tag all resources with environment, project, cost-center for billing
- Output stack exports (VPC ID, RDS endpoint) for cross-stack references
- Use CDK Pipelines for automated deployment via CodePipeline

---

### CI/CD Pipeline: GitHub Actions

**Workflow Stages**:
1. **Lint & Format**: ESLint, Prettier (fail fast on code quality issues)
2. **Test**: Jest unit tests (80% coverage threshold), Supertest integration tests
3. **Build**: TypeScript compilation, esbuild bundling
4. **Security Scan**: npm audit (high/critical vulns), Semgrep (SAST), git-secrets
5. **Deploy Infrastructure**: CDK deploy (dev on push to develop, staging on push to staging, prod on tag)
6. **Deploy Application**: Lambda deployment packages, run database migrations
7. **Smoke Tests**: Health check endpoints, critical path E2E tests
8. **Notifications**: Slack notification on success/failure

**Environments**:
- **dev**: Auto-deploy on merge to develop branch, t4g.micro RDS/Redis
- **staging**: Auto-deploy on merge to staging branch, matches prod config
- **prod**: Manual approval on git tag (v1.0.0), db.t4g.small RDS, cache.t4g.small Redis

---

## Conclusion

This research document establishes technology decisions aligned with LeadFlow AI Constitution principles. The selected stack (TypeScript, Express.js, PostgreSQL, Redis, Claude API, SNS/SQS, X-Ray) meets all functional requirements (FR-001 through FR-037) and success criteria (SC-001 through SC-012) while maintaining serverless-first architecture, event-driven patterns, security by design, and cost optimization.

**Key Decisions**:
- ✅ Node.js 20 + TypeScript for type-safe serverless development
- ✅ PostgreSQL 15 for ACID compliance and JSON support
- ✅ Redis 7 for 70% cache hit rate target
- ✅ Claude Sonnet 4 for 85% AI accuracy at $14/month cost
- ✅ SNS/SQS for decoupled event-driven architecture
- ✅ X-Ray + CloudWatch for comprehensive observability
- ✅ AWS CDK for infrastructure as code
- ✅ GitHub Actions for automated CI/CD

**Next Steps**: Proceed to Phase 1 (data-model.md, contracts/, quickstart.md) to define entity schemas and API contracts.
