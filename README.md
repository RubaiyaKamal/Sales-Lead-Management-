# LeadFlow AI - Lead Management with AI-Powered BANT Qualification

[![Tests](https://github.com/leadflow-ai/leadflow-ai/workflows/Tests/badge.svg)](https://github.com/leadflow-ai/leadflow-ai/actions)
[![Deploy](https://github.com/leadflow-ai/leadflow-ai/workflows/Deploy/badge.svg)](https://github.com/leadflow-ai/leadflow-ai/actions)
[![License](https://img.shields.io/badge/license-UNLICENSED-blue.svg)](LICENSE)

A modern, cloud-native lead management system with AI-powered BANT (Budget, Authority, Need, Timeline) qualification using Anthropic Claude API. Built with Kubernetes microservices architecture, Dapr runtime, and event-driven patterns.

## Features

- **CRUD Operations**: Complete lead lifecycle management (Create, Read, Update, Delete)
- **AI Qualification**: Automatic BANT scoring (0-100) using Claude API
- **Event-Driven**: Kafka-based (Redpanda) event streaming for notifications and analytics
- **Microservices**: Scalable architecture with backend API, notification service, and follow-up service
- **Kubernetes-Native**: Helm charts for multi-environment deployment (dev/prod)
- **Dapr Integration**: Infrastructure abstraction for Pub/Sub, State Store, and Secrets
- **Multi-Channel Notifications**: Email (SendGrid) and WhatsApp (Twilio) notifications
- **Follow-up Automation**: Cron-based follow-up reminders
- **Observability**: Prometheus metrics, structured JSON logging, distributed tracing
- **Security**: JWT authentication, RBAC, rate limiting, GDPR compliance

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend      │────▶│   Backend API    │────▶│   PostgreSQL        │
│   (Future)      │     │   (Express.js)   │     │   (Neon DB)         │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                               │
                               │ Dapr Sidecar
                               │
                        ┌──────┴──────┐
                        │             │
                   ┌────▼────┐   ┌────▼────┐
                   │  Redis  │   │  Kafka  │
                   │  State  │   │ Pub/Sub │
                   └─────────┘   └────┬────┘
                                      │
                        ┌─────────────┴──────────────┐
                        │                            │
                 ┌──────▼──────────┐        ┌────────▼─────────┐
                 │  Notification   │        │   Follow-up      │
                 │    Service      │        │    Service       │
                 └─────────────────┘        └──────────────────┘
```

## Technology Stack

- **Backend**: Node.js 20, TypeScript 5.3+, Express.js 4.x
- **AI**: Anthropic Claude API (claude-3-sonnet)
- **Database**: PostgreSQL 15 (Neon DB serverless)
- **Caching**: Redis 7
- **Event Streaming**: Redpanda Cloud (Kafka-compatible)
- **Orchestration**: Kubernetes (DOKS), Helm 3, Dapr 1.12+
- **Notifications**: SendGrid (Email), Twilio (WhatsApp)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana
- **Testing**: Jest, Supertest

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- kubectl
- Helm 3
- Minikube (for local Kubernetes) or DOKS cluster
- Dapr CLI

### Local Development (Docker Compose)

1. **Clone the repository**
   ```bash
   git clone https://github.com/leadflow-ai/leadflow-ai.git
   cd leadflow-ai
   ```

2. **Start infrastructure services**
   ```bash
   docker-compose up -d
   ```
   This starts PostgreSQL, Redis, and Redpanda locally.

3. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your credentials
   ```

4. **Install dependencies and run database migrations**
   ```bash
   cd backend
   npm install
   npm run migrate
   ```

5. **Start the backend API**
   ```bash
   npm run dev
   ```
   API available at `http://localhost:8000`

6. **Run tests**
   ```bash
   npm test
   ```

### Kubernetes Deployment (Minikube)

1. **Start Minikube**
   ```bash
   minikube start --cpus=4 --memory=8192
   minikube addons enable ingress
   ```

2. **Initialize Dapr**
   ```bash
   dapr init --kubernetes --wait
   ```

3. **Create namespace and secrets**
   ```bash
   kubectl create namespace leadflow-ai
   kubectl create secret generic leadflow-database-secret \
     --from-literal=DATABASE_URL="postgresql://..." \
     -n leadflow-ai
   # Repeat for other secrets (see kubernetes/dapr-components/kubernetes-secrets.yaml)
   ```

4. **Apply Dapr components**
   ```bash
   kubectl apply -f kubernetes/dapr-components/ -n leadflow-ai
   ```

5. **Deploy with Helm**
   ```bash
   helm install leadflow-ai ./helm/leadflow-ai \
     -n leadflow-ai \
     -f helm/leadflow-ai/values-dev.yaml
   ```

6. **Access the API**
   ```bash
   kubectl port-forward svc/leadflow-ai-backend 8000:8000 -n leadflow-ai
   curl http://localhost:8000/health/live
   ```

### Production Deployment (DOKS)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production deployment instructions.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| POST | `/api/v1/leads` | Create a new lead |
| GET | `/api/v1/leads` | List leads (with filtering/pagination) |
| GET | `/api/v1/leads/:id` | Get lead details |
| PATCH | `/api/v1/leads/:id` | Update lead |
| DELETE | `/api/v1/leads/:id` | Delete lead (admin only) |
| POST | `/api/v1/leads/:id/qualify` | AI-qualify lead (BANT scoring) |

See [OpenAPI specification](./specs/001-lead-crud-ai/contracts/leads-api.openapi.yaml) for full API documentation.

## Environment Variables

### Backend API
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `ANTHROPIC_API_KEY`: Claude API key
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `KAFKA_BROKERS`: Kafka broker addresses
- `NODE_ENV`: `development` | `production`
- `LOG_LEVEL`: `debug` | `info` | `warn` | `error`

### Notification Service
- `SENDGRID_API_KEY`: SendGrid API key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: Twilio credentials
- `FROM_EMAIL`: Sender email address

### Follow-up Service
- `DATABASE_URL`: PostgreSQL connection string
- `KAFKA_BROKERS`: Kafka broker addresses

## Development

### Project Structure
```
.
├── backend/                    # Backend API service
│   ├── src/
│   │   ├── api/               # API handlers and middleware
│   │   ├── models/            # TypeScript models
│   │   ├── services/          # Business logic
│   │   └── lib/               # Utilities
│   ├── tests/                 # Unit and integration tests
│   └── migrations/            # Database migrations
├── services/
│   ├── notification-service/  # Email/WhatsApp notifications
│   └── follow-up-service/     # Follow-up cron processor
├── helm/leadflow-ai/          # Helm chart
├── kubernetes/                # Kubernetes manifests
│   ├── base/
│   └── dapr-components/
├── specs/                     # Specification-driven development
│   └── 001-lead-crud-ai/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       └── contracts/
└── docker-compose.yml         # Local development setup
```

### Running Tests
```bash
cd backend
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Code Quality
```bash
npm run lint            # ESLint
npm run lint:fix        # Auto-fix issues
npm run format          # Prettier
npm run typecheck       # TypeScript type checking
```

## Monitoring

- **Metrics**: Prometheus endpoint at `/metrics`
- **Logs**: Structured JSON logs (Pino)
- **Tracing**: Dapr distributed tracing (compatible with Zipkin/Jaeger)
- **Dashboards**: Grafana dashboards (see `monitoring/grafana/`)

## Security

- **Authentication**: JWT tokens (validated via middleware)
- **Authorization**: Role-Based Access Control (RBAC)
  - `admin`: Full access (including delete)
  - `manager`: Team-level access
  - `sales_rep`: Own leads access
- **Rate Limiting**: 100 requests/hour per user
- **Data Protection**: GDPR-compliant deletion, audit logging
- **Secrets Management**: Kubernetes Secrets via Dapr Secret Store

## Contributing

This is a private project. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

UNLICENSED - Proprietary software

## Support

- **Issues**: [GitHub Issues](https://github.com/leadflow-ai/leadflow-ai/issues)
- **Documentation**: [Spec-Driven Development docs](./specs/)
- **Contact**: team@leadflow-ai.example.com

---

Built with [Spec-Driven Development (SDD)](https://spec-first.dev) methodology.
