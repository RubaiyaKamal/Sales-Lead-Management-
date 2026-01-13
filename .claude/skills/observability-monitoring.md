---
description: Expert assistance with logging, monitoring, health checks, and observability
---

# SKILL: Observability and Monitoring

## CONTEXT

The user needs help with observability and monitoring including:

- Logging setup and configuration (structured logging)
- Monitoring and metrics collection
- Health checks and readiness probes
- Application Performance Monitoring (APM)
- Alerting configuration
- Distributed tracing
- Dashboard creation

**User's specific request:**

$ARGUMENTS

## YOUR ROLE

Act as an observability expert with knowledge in:

- Logging best practices and structured logging
- Metrics and monitoring systems (Prometheus, Grafana, etc.)
- Health check patterns for Kubernetes
- Distributed tracing (Jaeger, Zipkin, OpenTelemetry)
- Alert design and incident response
- Performance monitoring and optimization

## OUTPUT STRUCTURE

### Step 1: Assess Requirements

Clarify:
- What application/service needs observability?
- What platform (Kubernetes, Docker, serverless)?
- What logging destination (stdout, file, external service)?
- What metrics are important (latency, throughput, errors)?
- What alerting channels (email, Slack, PagerDuty)?

### Step 2: Structured Logging Implementation

**Node.js (Pino):**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage
logger.info({ userId: '123', action: 'login' }, 'User logged in');
logger.error({ err: error, userId: '123' }, 'Failed to process request');
```

**Python (structlog):**
```python
import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger()

# Usage
logger.info("user_logged_in", user_id="123", action="login")
logger.error("request_failed", user_id="123", error=str(e))
```

### Step 3: Health Checks

**Application Health Endpoints:**

```typescript
// Express.js example
import express from 'express';

const app = express();

// Liveness probe - is the app running?
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe - is the app ready to serve traffic?
app.get('/health/ready', async (req, res) => {
  try {
    // Check database connection
    await db.ping();
    // Check Redis connection
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok',
        cache: 'ok'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});

// Startup probe - has the app finished starting?
app.get('/health/startup', (req, res) => {
  if (appIsInitialized) {
    res.status(200).json({ status: 'started' });
  } else {
    res.status(503).json({ status: 'starting' });
  }
});
```

**Kubernetes Health Check Configuration:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: myapp
        image: myapp:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health/startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30
```

### Step 4: Metrics Collection

**Prometheus Metrics (Node.js):**

```typescript
import client from 'prom-client';
import express from 'express';

const app = express();

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const taskCreatedCounter = new client.Counter({
  name: 'tasks_created_total',
  help: 'Total number of tasks created',
  labelNames: ['user_id'],
  registers: [register],
});

// Middleware to track request duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || 'unknown', res.statusCode.toString())
      .observe(duration);
  });
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Usage in business logic
taskCreatedCounter.labels(userId).inc();
```

**Prometheus ServiceMonitor (Kubernetes):**

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: web
    path: /metrics
    interval: 30s
```

### Step 5: Distributed Tracing

**OpenTelemetry Setup:**

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const provider = new NodeTracerProvider();

const exporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});
```

### Step 6: Alerting Rules

**Prometheus Alert Rules:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
data:
  alerts.yml: |
    groups:
    - name: application
      interval: 30s
      rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/second"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "95th percentile latency is {{ $value }} seconds"

      - alert: PodDown
        expr: up{job="myapp"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Application pod is down"
          description: "Pod {{ $labels.pod }} has been down for more than 2 minutes"
```

### Step 7: Grafana Dashboard

Provide dashboard JSON or configuration for:
- Request rate and latency
- Error rates
- Resource usage (CPU, memory)
- Custom business metrics
- Service dependency map

### Step 8: Log Aggregation

**Kubernetes Logging (FluentBit/Loki):**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Log_Level     info

    [INPUT]
        Name              tail
        Path              /var/log/containers/*myapp*.log
        Parser            docker
        Tag               kube.*

    [OUTPUT]
        Name              loki
        Match             *
        Host              loki
        Port              3100
        Labels            job=myapp
```

## ACCEPTANCE CRITERIA

- Structured logging is implemented with consistent format
- Health check endpoints are implemented and tested
- Liveness, readiness, and startup probes configured in Kubernetes
- Metrics are exposed in Prometheus format
- Key business and technical metrics are tracked
- Distributed tracing is configured (if applicable)
- Alert rules are defined for critical conditions
- Dashboards visualize important metrics
- Logs are aggregated and searchable
- Documentation covers metric definitions and alert runbooks
