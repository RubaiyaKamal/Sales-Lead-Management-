# ADR 0001: Use Kubernetes Instead of AWS Serverless Architecture

**Date**: 2025-12-31
**Status**: Accepted
**Deciders**: Lap Zone (Product Owner), Claude (Technical Advisor)
**Consulted**: Constitution Principle I (Serverless-First Architecture)

---

## Context

The initial implementation plan (specs/001-lead-crud-ai/plan.md) followed Constitution Principle I: "Serverless-First Architecture" using:
- AWS Lambda for compute
- AWS API Gateway for REST API
- AWS SNS/SQS for event messaging
- AWS RDS/ElastiCache for data storage

However, the product owner has requested a shift to **containerized microservices** architecture using:
- **DigitalOcean Kubernetes (DOKS)** for container orchestration
- **Redpanda Cloud** (Kafka-compatible) for event streaming
- **Dapr** for distributed application runtime
- **Minikube** for local development
- **Neon DB** for PostgreSQL (unchanged)

This ADR documents the rationale for deviating from the constitution and the trade-offs involved.

---

## Decision

We will use **Kubernetes-based microservices architecture** with containerized deployments instead of AWS serverless functions.

### Architecture Components

| Requirement | AWS Serverless (Original) | Kubernetes (Adopted) |
|-------------|---------------------------|----------------------|
| **Compute** | AWS Lambda | DigitalOcean Kubernetes (DOKS) + Docker containers |
| **API Layer** | AWS API Gateway | Kubernetes Ingress + Service Mesh |
| **Event Messaging** | AWS SNS + SQS | Redpanda Cloud (Kafka) + Dapr Pub/Sub |
| **State Management** | AWS RDS + ElastiCache | PostgreSQL (Neon DB) + Dapr State Store |
| **Service Communication** | Direct Lambda invocation | Dapr Service Invocation |
| **Scheduled Tasks** | AWS EventBridge | Dapr Cron Bindings |
| **Secrets Management** | AWS Secrets Manager | Kubernetes Secrets + Dapr Secret Store |
| **Observability** | AWS X-Ray + CloudWatch | Prometheus + Grafana + ELK Stack |
| **Local Development** | LocalStack + SAM CLI | Minikube + Dapr CLI |
| **Deployment** | AWS CDK (TypeScript) | Helm Charts + GitHub Actions |

---

## Rationale

### Why Kubernetes Over Serverless?

**1. Cost Predictability ($161/month vs $350-$685/month)**
- **DOKS**: Fixed cost of $161/month for 3-node cluster (s-2vcpu-4gb)
- **AWS Lambda**: Variable cost scales with invocations, can spike unexpectedly
- **Redpanda Cloud**: Free serverless tier (vs AWS SNS/SQS metered pricing)
- **Savings**: ~40-55% cost reduction at 10K leads scale

**2. Vendor Lock-in Avoidance**
- Kubernetes is **portable across cloud providers** (DigitalOcean, AWS, GCP, Azure)
- Redpanda is **Kafka API-compatible** (can switch to Confluent, AWS MSK, self-hosted)
- Dapr abstracts infrastructure (can swap Redis → PostgreSQL state store without code changes)
- **AWS Lambda/SNS/SQS**: Tightly coupled to AWS ecosystem

**3. Developer Experience**
- **Minikube**: Full Kubernetes environment locally (vs LocalStack limitations)
- **Dapr CLI**: Run microservices with sidecars locally (vs complex Lambda emulation)
- **Docker**: Standard containerization (vs Lambda runtime constraints)
- **Debugging**: Attach debuggers to containers (vs CloudWatch logs-only debugging)

**4. Technology Skills Alignment**
- Team has **existing DevOps skills** for Kubernetes, Docker, Helm
- Kubernetes skills are **transferable** across industries/companies
- AWS Lambda skills are **niche and vendor-specific**

**5. Event-Driven Architecture Flexibility**
- **Kafka/Redpanda**: Native support for event sourcing, CQRS, stream processing
- **Dapr Pub/Sub**: Framework-agnostic, can swap backing store (Kafka → RabbitMQ)
- **AWS SNS/SQS**: Limited to simple pub/sub, no stream processing

**6. DigitalOcean $200 Credit**
- **60 days free** with $200 credit (vs AWS Free Tier limitations)
- Reduces initial cost barrier for MVP launch

---

## Consequences

### Positive

✅ **Cost Savings**: ~40-55% reduction in monthly infrastructure costs
✅ **Portability**: Can migrate to any cloud provider or on-premises
✅ **Developer Experience**: Minikube provides true local Kubernetes environment
✅ **Skills Transfer**: Kubernetes knowledge applicable across companies/industries
✅ **Event Streaming**: Kafka enables advanced patterns (event sourcing, CQRS, stream processing)
✅ **Dapr Abstraction**: Swap infrastructure without code changes
✅ **DigitalOcean Credit**: $200 free credit for 60 days

### Negative

⚠️ **Operational Complexity**: Managing Kubernetes clusters requires DevOps expertise
⚠️ **Cold Start**: Not applicable (pods remain warm, but need to manage pod scaling)
⚠️ **Resource Overhead**: Containers consume more memory than Lambda functions
⚠️ **Monitoring Complexity**: Need to set up Prometheus/Grafana vs native CloudWatch
⚠️ **Initial Setup Time**: Helm charts and Kubernetes manifests more complex than CDK

### Mitigations

| Risk | Mitigation |
|------|-----------|
| **Operational Complexity** | Use Helm charts for standardized deployments, leverage DigitalOcean managed Kubernetes |
| **Resource Overhead** | Set resource limits in Helm values, use Horizontal Pod Autoscaling |
| **Monitoring Complexity** | Use kube-prometheus-stack Helm chart for turnkey Prometheus + Grafana setup |
| **Initial Setup Time** | Reuse existing DevOps skills (docker-containerization.md, kubernetes-deployment.md, helm-charts.md) |

---

## Alternatives Considered

### Alternative 1: AWS Serverless (Original Plan)

**Pros**:
- Aligns with Constitution Principle I
- Auto-scaling built-in
- Minimal operational overhead
- Native AWS observability (X-Ray, CloudWatch)

**Cons**:
- Higher cost ($350-$685/month at scale)
- Vendor lock-in to AWS
- Lambda cold starts impact latency
- Complex local development (LocalStack, SAM CLI)

**Decision**: Rejected due to cost concerns and vendor lock-in risk

### Alternative 2: Hybrid (Kubernetes + AWS Managed Services)

**Pros**:
- Use EKS (AWS Kubernetes) for containers
- Use AWS RDS, ElastiCache, MSK (managed Kafka)
- Best of both worlds

**Cons**:
- Still locked into AWS ecosystem
- Higher cost than DigitalOcean
- EKS more expensive than DOKS ($73/month EKS control plane vs free DOKS control plane)

**Decision**: Rejected due to AWS lock-in and higher cost

### Alternative 3: Self-Managed Kubernetes (VPS)

**Pros**:
- Lowest cost (raw VPS pricing)
- Full control

**Cons**:
- Need to manage Kubernetes control plane
- High operational burden
- No managed services (need to run own PostgreSQL, Redis, Kafka)

**Decision**: Rejected due to operational complexity for MVP phase

---

## Implementation Plan Updates

The following planning artifacts have been updated to reflect this decision:

1. **specs/001-lead-crud-ai/plan.md**
   - ✅ Updated Technical Context (TypeScript + Node.js on Kubernetes)
   - ✅ Updated Project Structure (Helm charts, Dockerfile, Dapr components)
   - ✅ Updated Constitution Check (note deviation from Principle I)

2. **specs/001-lead-crud-ai/research.md**
   - ✅ Replaced AWS Lambda → DigitalOcean Kubernetes
   - ✅ Replaced AWS SNS/SQS → Redpanda Cloud + Dapr Pub/Sub
   - ✅ Updated cost estimation ($161/month DOKS vs $350/month AWS)
   - ✅ Added Dapr integration patterns

3. **specs/001-lead-crud-ai/data-model.md**
   - ⏭️ No changes needed (PostgreSQL schema remains same)

4. **specs/001-lead-crud-ai/contracts/**
   - ⏭️ Minimal changes (event schemas remain same, routing changes to Kafka topics)

5. **specs/001-lead-crud-ai/quickstart.md**
   - ✅ Replaced AWS LocalStack → Minikube + Dapr
   - ✅ Added Docker Compose for Redpanda
   - ✅ Added Helm chart installation steps

---

## Constitution Deviation

### Affected Principle

**Principle I: Serverless-First Architecture**

> **MUST use AWS serverless services as the primary infrastructure foundation.**
> - All compute workloads MUST run on AWS Lambda unless justified exceptions exist
> - State MUST be externalized to managed services (RDS, ElastiCache, S3)

### Justification

This ADR provides the **justified exception** mentioned in the constitution:

- **Cost**: 40-55% savings justify deviation
- **Portability**: Avoiding vendor lock-in is strategic long-term decision
- **Skills**: Team has existing Kubernetes expertise
- **State Management**: Still using managed services (Neon DB for PostgreSQL, Redis via Dapr)

### Amendment Recommendation

Propose amending Constitution Principle I to:

**Original**:
> **MUST use AWS serverless services as the primary infrastructure foundation.**

**Amended** (Proposed):
> **MUST use cloud-native managed services as the primary infrastructure foundation, prioritizing serverless when cost-effective and strategically appropriate. Kubernetes-based deployments are acceptable when justified by cost, portability, or team expertise.**

---

## References

- [DigitalOcean Kubernetes (DOKS) Pricing](https://www.digitalocean.com/pricing/kubernetes)
- [Redpanda Cloud Serverless](https://redpanda.com/redpanda-cloud)
- [Dapr Documentation](https://docs.dapr.io)
- [Neon DB Serverless PostgreSQL](https://neon.tech)
- [Original Plan: specs/001-lead-crud-ai/plan.md](../specs/001-lead-crud-ai/plan.md)
- [Constitution: .specify/memory/constitution.md](../.specify/memory/constitution.md)

---

**Signed**: Lap Zone (Product Owner), 2025-12-31
