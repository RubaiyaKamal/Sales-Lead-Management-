---
id: 001
title: Create DevOps Infrastructure Skills
stage: general
date: 2025-12-31
surface: agent
model: claude-sonnet-4-5
feature: none
branch: main
user: Lap Zone
command: create-skills
labels: ["skills", "devops", "infrastructure", "kubernetes", "docker", "helm", "kafka", "dapr", "ci-cd", "observability"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - .claude/skills/docker-containerization.md
  - .claude/skills/kubernetes-deployment.md
  - .claude/skills/kafka-redpanda.md
  - .claude/skills/dapr-microservices.md
  - .claude/skills/ci-cd-github-actions.md
  - .claude/skills/observability-monitoring.md
  - .claude/skills/helm-charts.md
tests:
---

## Prompt

please create these skills in my .claude folder so whenever I need so I used these plz Core Skills to Create:

docker-containerization

Building Docker images
Multi-stage builds
Docker Compose configurations
Container optimization


kubernetes-deployment

Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets)
Helm charts creation and management
DOKS (DigitalOcean Kubernetes) setup
Minikube local deployment


kafka-redpanda

Kafka/Redpanda setup and configuration
Topic creation and management
Producer/consumer implementation
Event schema design


dapr-microservices

Dapr components configuration
Pub/Sub patterns
State management
Service invocation
Bindings (cron jobs)
Secrets management


ci-cd-github-actions

GitHub Actions workflows
Automated deployments to Kubernetes
Docker image building and pushing
Environment-specific deployments


observability-monitoring

Logging setup (for Kubernetes)
Monitoring configuration
Health checks and readiness probes


helm-charts

Helm chart structure
Values files for different environments
Chart dependencies

## Response snapshot

Created 7 comprehensive DevOps infrastructure skills in .claude/skills/ directory:

1. docker-containerization.md (2.2K) - Docker images, multi-stage builds, Docker Compose, container optimization
2. kubernetes-deployment.md (3.2K) - Kubernetes manifests, Helm charts, DOKS setup, Minikube deployment
3. kafka-redpanda.md (4.2K) - Kafka/Redpanda setup, topic management, producer/consumer implementation, event schemas
4. dapr-microservices.md (5.0K) - Dapr components (Pub/Sub, State, Bindings, Secrets), service invocation
5. ci-cd-github-actions.md (7.4K) - GitHub Actions workflows, automated Kubernetes deployments, multi-environment CI/CD
6. observability-monitoring.md (8.6K) - Structured logging, Prometheus metrics, health checks, distributed tracing, alerting
7. helm-charts.md (11K) - Helm chart structure, multi-environment values files, templating, dependencies

Each skill includes:
- Clear context and role definition
- Step-by-step workflow structure
- Code examples and configurations
- Best practices and security considerations
- Acceptance criteria for quality assurance

## Outcome

- ✅ Impact: Created 7 production-ready DevOps skills covering the complete infrastructure stack from containerization to deployment and monitoring
- 🧪 Tests: No automated tests required for skill definitions
- 📁 Files: 7 new skill files created in .claude/skills/
- 🔁 Next prompts: User can now invoke these skills for specific infrastructure tasks (e.g., "Help me with docker-containerization for my Node.js app")
- 🧠 Reflection: Skills follow the established command/skill pattern found in .claude/commands/, providing consistent structure with description frontmatter, context, role, and workflow sections

## Evaluation notes (flywheel)

- Failure modes observed: None - all files created successfully
- Graders run and results (PASS/FAIL): PASS - All skills follow the established pattern, include comprehensive examples, and provide clear acceptance criteria
- Prompt variant (if applicable): N/A
- Next experiment (smallest change to try): Could add language-specific variants (e.g., docker-containerization-nodejs, docker-containerization-python) if users need more targeted guidance
