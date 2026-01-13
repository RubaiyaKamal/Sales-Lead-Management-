# Tasks: Lead Management with AI Qualification

**Input**: Design documents from `/specs/001-lead-crud-ai/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Architecture**: Kubernetes microservices with Express.js backend, Dapr runtime, PostgreSQL (Neon DB), Redis state store, Redpanda (Kafka) event streaming

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:
- **Backend API**: `backend/src/`
- **Microservices**: `services/{service-name}/src/`
- **Kubernetes**: `kubernetes/`
- **Helm Charts**: `helm/leadflow-ai/`
- **Docker**: Root-level `Dockerfile` per service

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure per plan.md (backend/, services/, kubernetes/, helm/)
- [ ] T002 Initialize backend Node.js project with TypeScript 5.3+ in backend/package.json
- [ ] T003 [P] Install core dependencies (Express.js 4.x, @dapr/dapr, pg, ioredis) in backend/package.json
- [ ] T004 [P] Configure TypeScript compiler options in backend/tsconfig.json
- [ ] T005 [P] Setup ESLint and Prettier for code quality in backend/.eslintrc.json
- [ ] T006 [P] Create Docker Compose file for local services (PostgreSQL, Redis, Redpanda) in docker-compose.yml
- [ ] T007 [P] Create backend Dockerfile with multi-stage build in backend/Dockerfile
- [ ] T008 [P] Setup .env.example file with required environment variables in backend/.env.example
- [ ] T009 [P] Initialize Git repository and create .gitignore for Node.js, Docker, IDE files

**Checkpoint**: Project structure ready, dependencies installed, local development environment configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Migrations

- [ ] T010 Setup database migration framework with Alembic/Knex in backend/src/lib/migrations.ts
- [ ] T011 Create database schema migration V001 (users, leads, lead_scores, activity_logs tables) per data-model.md in backend/migrations/001_initial_schema.sql
- [ ] T012 Create database trigger functions (update_updated_at_column, update_last_contacted_at_column, update_converted_at_column) in backend/migrations/001_initial_schema.sql
- [ ] T013 Setup PostgreSQL connection pool with Neon DB in backend/src/lib/database.ts

### Core Infrastructure

- [ ] T014 [P] Implement structured JSON logger with Pino in backend/src/lib/logger.ts
- [ ] T015 [P] Setup environment configuration management in backend/src/lib/config.ts
- [ ] T016 [P] Create centralized error handling middleware in backend/src/api/middleware/errorHandler.ts
- [ ] T017 [P] Setup Dapr client configuration in backend/src/lib/dapr.ts

### TypeScript Models

- [ ] T018 [P] Create User model with TypeScript types and enums in backend/src/models/User.ts
- [ ] T019 [P] Create Lead model with enums (LeadSource, LeadStatus, QualificationStatus) in backend/src/models/Lead.ts
- [ ] T020 [P] Create LeadScore model with BANT score types in backend/src/models/LeadScore.ts
- [ ] T021 [P] Create ActivityLog model with ActivityAction enum in backend/src/models/ActivityLog.ts

### Authentication & Authorization

- [ ] T022 Implement JWT validation middleware with Cognito verification in backend/src/api/middleware/auth.ts
- [ ] T023 Implement RBAC middleware (admin, manager, sales_rep roles) in backend/src/api/middleware/rbac.ts

### Validation & Utilities

- [ ] T024 [P] Create input validation utilities (email format, E.164 phone, field lengths) in backend/src/lib/validator.ts
- [ ] T025 [P] Create rate limiter middleware (100 req/hour per user) in backend/src/api/middleware/rateLimiter.ts

### Dapr Components Configuration

- [ ] T026 [P] Create Dapr Pub/Sub component for Redpanda (Kafka) in kubernetes/dapr-components/kafka-pubsub.yaml
- [ ] T027 [P] Create Dapr State Store component for Redis in kubernetes/dapr-components/redis-statestore.yaml
- [ ] T028 [P] Create Dapr Secret Store component for Kubernetes Secrets in kubernetes/dapr-components/kubernetes-secrets.yaml
- [ ] T029 [P] Create namespace and ConfigMap for Kubernetes in kubernetes/base/namespace.yaml

### Express.js Application Setup

- [ ] T030 Initialize Express.js application with middleware stack in backend/src/main.ts
- [ ] T031 Setup API routing structure (/api/v1/leads) in backend/src/api/routes.ts
- [ ] T032 Add health check endpoints (/health/live, /health/ready) in backend/src/api/handlers/health.ts

**Checkpoint**: Foundation ready - database schema deployed, Dapr components configured, authentication working, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Create New Lead (Priority: P1) 🎯 MVP

**Goal**: Enable sales reps to create new leads via POST /api/v1/leads endpoint with validation, duplicate detection, and event publishing

**Independent Test**: Submit lead creation request with valid data → verify lead created in database with status="new", qualification_status="not_qualified", assigned_to=null → verify "lead.created" event published to Kafka

### Implementation for User Story 1

- [ ] T033 [US1] Create LeadService with createLead method in backend/src/services/LeadService.ts
- [ ] T034 [US1] Implement lead creation business logic (validate, check duplicates, insert) in backend/src/services/LeadService.ts
- [ ] T035 [US1] Setup DaprPubSubService for event publishing in backend/src/services/DaprPubSubService.ts
- [ ] T036 [US1] Implement createLead API handler (POST /api/v1/leads) in backend/src/api/handlers/createLead.ts
- [ ] T037 [US1] Add input validation for CreateLeadRequest (name, email, phone, company, leadSource, metadata) in backend/src/api/handlers/createLead.ts
- [ ] T038 [US1] Implement duplicate email detection with unique constraint handling in backend/src/services/LeadService.ts
- [ ] T039 [US1] Publish "lead.created" event to Kafka via Dapr after successful creation in backend/src/services/LeadService.ts
- [ ] T040 [US1] Create activity log entry for lead creation in backend/src/services/LeadService.ts
- [ ] T041 [US1] Add structured error responses (400 validation, 409 duplicate) per OpenAPI spec in backend/src/api/handlers/createLead.ts
- [ ] T042 [US1] Wire createLead handler to Express.js router in backend/src/api/routes.ts

**Checkpoint**: User Story 1 complete - sales reps can create leads, duplicates are prevented, events are published, and activity is logged

---

## Phase 4: User Story 2 - View Lead Details and List (Priority: P2)

**Goal**: Enable sales teams to list all leads with filtering/pagination (GET /api/v1/leads) and view individual lead details (GET /api/v1/leads/:id)

**Independent Test**: Create sample leads → query list with filters (status, source, search) → verify paginated results match filters → request individual lead by ID → verify complete lead object with latest score returned

### Implementation for User Story 2

- [ ] T043 [P] [US2] Implement DaprStateService for Redis caching in backend/src/services/DaprStateService.ts
- [ ] T044 [US2] Create LeadService.listLeads method with filtering, pagination, search in backend/src/services/LeadService.ts
- [ ] T045 [US2] Implement database query builder for dynamic filters (status, qualification_status, lead_source, assigned_to, search) in backend/src/services/LeadService.ts
- [ ] T046 [US2] Add Redis caching with 5-minute TTL for lead list queries in backend/src/services/LeadService.ts
- [ ] T047 [US2] Create LeadService.getLeadById method with latest score join (LEFT JOIN LATERAL) in backend/src/services/LeadService.ts
- [ ] T048 [US2] Implement getLeads API handler (GET /api/v1/leads) in backend/src/api/handlers/getLeads.ts
- [ ] T049 [US2] Add query parameter validation (page, limit, sortBy, sortOrder) in backend/src/api/handlers/getLeads.ts
- [ ] T050 [US2] Implement getLead API handler (GET /api/v1/leads/:id) in backend/src/api/handlers/getLead.ts
- [ ] T051 [US2] Add RBAC checks (sales_rep sees assigned leads, manager sees team leads, admin sees all) in backend/src/api/handlers/getLeads.ts
- [ ] T052 [US2] Return structured LeadListResponse with pagination metadata per OpenAPI spec in backend/src/api/handlers/getLeads.ts
- [ ] T053 [US2] Wire getLeads and getLead handlers to Express.js router in backend/src/api/routes.ts

**Checkpoint**: User Story 2 complete - sales teams can filter/search leads efficiently with caching, and view detailed lead information with scores

---

## Phase 5: User Story 3 - Update Lead Information (Priority: P3)

**Goal**: Enable sales reps to update lead fields (PATCH /api/v1/leads/:id) with validation, optimistic locking, event publishing, and cache invalidation

**Independent Test**: Create lead → update specific fields (status, assigned_to, metadata) → verify only modified fields changed, updated_at timestamp updated, last_contacted_at set if status changed to contacted/qualified/converted → verify "lead.updated" event published → verify cache invalidated

### Implementation for User Story 3

- [ ] T054 [US3] Create LeadService.updateLead method with partial update logic in backend/src/services/LeadService.ts
- [ ] T055 [US3] Implement optimistic locking check using updated_at timestamp in backend/src/services/LeadService.ts
- [ ] T056 [US3] Add business logic for last_contacted_at auto-update when status changes in backend/src/services/LeadService.ts
- [ ] T057 [US3] Implement updateLead API handler (PATCH /api/v1/leads/:id) in backend/src/api/handlers/updateLead.ts
- [ ] T058 [US3] Add validation for UpdateLeadRequest (optional fields, email uniqueness if changed) in backend/src/api/handlers/updateLead.ts
- [ ] T059 [US3] Add RBAC checks (sales_rep updates assigned leads, manager updates team leads, admin updates all) in backend/src/api/handlers/updateLead.ts
- [ ] T060 [US3] Publish "lead.updated" event with changedFields and previous/new values to Kafka in backend/src/services/LeadService.ts
- [ ] T061 [US3] Create activity log entry for lead update with metadata (changed fields) in backend/src/services/LeadService.ts
- [ ] T062 [US3] Invalidate Redis cache entries for lead list and individual lead on update in backend/src/services/LeadService.ts
- [ ] T063 [US3] Handle 409 Conflict error for concurrent updates (optimistic locking) in backend/src/api/handlers/updateLead.ts
- [ ] T064 [US3] Wire updateLead handler to Express.js router in backend/src/api/routes.ts

**Checkpoint**: User Story 3 complete - sales reps can update leads safely with concurrency protection, automated timestamp management, and event notification

---

## Phase 6: User Story 4 - AI-Powered Lead Qualification (Priority: P4)

**Goal**: Enable AI-powered BANT qualification (POST /api/v1/leads/:id/qualify) with Claude API integration, score calculation, status updates, and async retry logic

**Independent Test**: Create lead → trigger qualification → verify Claude API called with BANT prompt → verify lead_scores record created with budget/authority/need/timeline scores (0-25 each) → verify qualification_status updated based on total_score threshold (≥60=qualified, <40=disqualified, 40-59=in_progress) → verify "lead.qualified" event published if qualified

### Implementation for User Story 4

- [ ] T065 [P] [US4] Install Anthropic SDK (@anthropic-ai/sdk) in backend/package.json
- [ ] T066 [US4] Create AIQualificationService with Claude API client setup in backend/src/services/AIQualificationService.ts
- [ ] T067 [US4] Implement BANT scoring prompt template (analyze lead for Budget, Authority, Need, Timeline) in backend/src/services/AIQualificationService.ts
- [ ] T068 [US4] Create qualifyLead method with Claude API call and structured JSON response parsing in backend/src/services/AIQualificationService.ts
- [ ] T069 [US4] Implement score validation (0-25 per category, 0-100 total) in backend/src/services/AIQualificationService.ts
- [ ] T070 [US4] Create LeadService.createLeadScore method to insert lead_scores record in backend/src/services/LeadService.ts
- [ ] T071 [US4] Implement qualification_status update logic (≥60=qualified, <40=disqualified, 40-59=in_progress) in backend/src/services/LeadService.ts
- [ ] T072 [US4] Implement qualifyLead API handler (POST /api/v1/leads/:id/qualify) in backend/src/api/handlers/qualifyLead.ts
- [ ] T073 [US4] Add RBAC checks (sales_rep qualifies assigned leads, manager qualifies team leads, admin qualifies all) in backend/src/api/handlers/qualifyLead.ts
- [ ] T074 [US4] Publish "lead.qualified" event to Kafka if qualification_status changes to "qualified" in backend/src/services/LeadService.ts
- [ ] T075 [US4] Create activity log entry for qualification with AI reasoning in backend/src/services/LeadService.ts
- [ ] T076 [US4] Implement error handling for Claude API failures (catch, log, queue to Kafka for retry) in backend/src/services/AIQualificationService.ts
- [ ] T077 [US4] Return 202 Accepted response when qualification queued for async processing in backend/src/api/handlers/qualifyLead.ts
- [ ] T078 [US4] Create Kafka consumer for AI qualification retries in backend/src/consumers/aiQualificationConsumer.ts
- [ ] T079 [US4] Implement exponential backoff retry logic (max 3 attempts) in backend/src/consumers/aiQualificationConsumer.ts
- [ ] T080 [US4] Wire qualifyLead handler to Express.js router in backend/src/api/routes.ts

**Checkpoint**: User Story 4 complete - AI qualification working with BANT methodology, scores stored historically, async retry for failures, high-value leads flagged

---

## Phase 7: User Story 5 - Delete Lead (Priority: P5)

**Goal**: Enable admin users to permanently delete leads (DELETE /api/v1/leads/:id) with cascade deletion, GDPR compliance, and audit logging

**Independent Test**: Create lead with associated data (scores, activity logs) → delete as admin user → verify lead and all related records deleted via CASCADE → verify activity log created for deletion → verify 403 Forbidden if non-admin attempts deletion

### Implementation for User Story 5

- [ ] T081 [US5] Create LeadService.deleteLead method with cascade deletion logic in backend/src/services/LeadService.ts
- [ ] T082 [US5] Implement deleteLead API handler (DELETE /api/v1/leads/:id) in backend/src/api/handlers/deleteLead.ts
- [ ] T083 [US5] Add RBAC check to restrict deletion to admin role only in backend/src/api/handlers/deleteLead.ts
- [ ] T084 [US5] Create activity log entry for deletion with user_id, reason, gdpr_request flag in backend/src/services/LeadService.ts
- [ ] T085 [US5] Publish "lead.deleted" event to Kafka with lead metadata in backend/src/services/LeadService.ts
- [ ] T086 [US5] Return 204 No Content on successful deletion per OpenAPI spec in backend/src/api/handlers/deleteLead.ts
- [ ] T087 [US5] Invalidate Redis cache entries for deleted lead in backend/src/services/LeadService.ts
- [ ] T088 [US5] Wire deleteLead handler to Express.js router in backend/src/api/routes.ts

**Checkpoint**: User Story 5 complete - admin users can delete leads for GDPR compliance and data hygiene with full audit trail

---

## Phase 8: Kubernetes Deployment & Microservices

**Purpose**: Deploy backend API and supporting microservices to Kubernetes with Dapr, Helm, and observability

### Backend API Kubernetes Manifests

- [ ] T089 [P] Create backend Deployment manifest with Dapr annotations in helm/leadflow-ai/templates/backend-deployment.yaml
- [ ] T090 [P] Create backend Service manifest (ClusterIP) in helm/leadflow-ai/templates/backend-service.yaml
- [ ] T091 [P] Create Ingress manifest for /api/v1 routing in helm/leadflow-ai/templates/ingress.yaml
- [ ] T092 [P] Create backend HorizontalPodAutoscaler for scaling in helm/leadflow-ai/templates/backend-hpa.yaml

### Notification Microservice

- [ ] T093 [P] Create notification-service with Dapr Pub/Sub subscriber in services/notification-service/src/main.ts
- [ ] T094 [P] Implement email notification handler (SendGrid) in services/notification-service/src/notifiers/emailNotifier.ts
- [ ] T095 [P] Create notification-service Dockerfile in services/notification-service/Dockerfile
- [ ] T096 [P] Create notification-service Deployment manifest in helm/leadflow-ai/templates/notification-deployment.yaml

### Follow-up Microservice

- [ ] T097 [P] Create follow-up-service with Dapr Cron Binding in services/follow-up-service/src/main.ts
- [ ] T098 [P] Implement recurring follow-up processor in services/follow-up-service/src/followUpProcessor.ts
- [ ] T099 [P] Create Dapr Cron Binding component in kubernetes/dapr-components/followup-cron.yaml
- [ ] T100 [P] Create follow-up-service Dockerfile in services/follow-up-service/Dockerfile
- [ ] T101 [P] Create follow-up-service Deployment manifest in helm/leadflow-ai/templates/followup-deployment.yaml

### Helm Chart Configuration

- [ ] T102 [P] Create Helm Chart.yaml with app metadata in helm/leadflow-ai/Chart.yaml
- [ ] T103 [P] Create default values.yaml with shared configuration in helm/leadflow-ai/values.yaml
- [ ] T104 [P] Create values-dev.yaml for Minikube local development in helm/leadflow-ai/values-dev.yaml
- [ ] T105 [P] Create values-prod.yaml for DOKS production in helm/leadflow-ai/values-prod.yaml
- [ ] T106 [P] Create Helm _helpers.tpl with template functions in helm/leadflow-ai/templates/_helpers.tpl
- [ ] T107 [P] Create Kubernetes ConfigMap for environment variables in helm/leadflow-ai/templates/configmap.yaml
- [ ] T108 [P] Create Kubernetes Secrets manifest (template) in helm/leadflow-ai/templates/secrets.yaml

### Observability & Monitoring

- [ ] T109 [P] Add Prometheus metrics endpoints to backend API in backend/src/lib/metrics.ts
- [ ] T110 [P] Implement custom metrics (LeadCreated, LeadQualified, AIQualificationTime, LeadOperationLatency) in backend/src/lib/metrics.ts
- [ ] T111 [P] Create ServiceMonitor for Prometheus scraping in helm/leadflow-ai/templates/servicemonitor.yaml
- [ ] T112 [P] Add structured logging with trace IDs (X-Ray format) in backend/src/lib/logger.ts

### CI/CD Pipeline

- [ ] T113 Create GitHub Actions workflow for DOKS deployment in .github/workflows/deploy-doks.yml
- [ ] T114 Add Docker image build and push steps to GitHub Container Registry in .github/workflows/deploy-doks.yml
- [ ] T115 Add Helm chart deployment step with values-prod.yaml in .github/workflows/deploy-doks.yml

**Checkpoint**: Kubernetes deployment complete - backend API, notification service, and follow-up service running on DOKS with Dapr, monitored by Prometheus

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements, documentation, and validation

- [ ] T116 [P] Create comprehensive README.md with project overview, architecture, and quickstart link
- [ ] T117 [P] Validate quickstart.md local development steps (Minikube setup, Docker Compose, Dapr init)
- [ ] T118 [P] Add OpenAPI documentation endpoint (Swagger UI) to backend API
- [ ] T119 [P] Implement 90-day archival job for inactive leads (EventBridge → Lambda → S3 Glacier) per FR-036
- [ ] T120 [P] Add database connection pool monitoring and health checks
- [ ] T121 [P] Security review: validate input sanitization, parameterized queries, JWT validation
- [ ] T122 [P] Performance review: verify Redis caching, database indexes, query optimization
- [ ] T123 Run end-to-end validation: create lead → view → update → qualify → delete workflow

**Checkpoint**: Production-ready - all user stories implemented, deployed to Kubernetes, documented, secured, and validated

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Kubernetes Deployment (Phase 8)**: Can start after any user story is complete (typically after MVP = US1)
- **Polish (Phase 9)**: Depends on all desired user stories and deployment being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (independent)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories (independent)
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - May reference US1 (lead creation) but independently testable
- **User Story 5 (P5)**: Can start after Foundational (Phase 2) - No dependencies on other stories (independent)

### Within Each User Story

- Core implementation (models, services) before API handlers
- API handlers before router integration
- Service layer methods before event publishing
- Event publishing before activity logging
- RBAC checks integrated with handlers
- Cache invalidation integrated with mutations

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Tasks within a story marked [P] can run in parallel (different files)
- Different user stories can be worked on in parallel by different team members
- All Kubernetes/Helm tasks in Phase 8 marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# After foundational phase completes, launch User Story 1 tasks in parallel:

# Core services (parallel - different files):
Task T033: "Create LeadService with createLead method in backend/src/services/LeadService.ts"
Task T035: "Setup DaprPubSubService for event publishing in backend/src/services/DaprPubSubService.ts"

# Then sequentially:
Task T034: "Implement lead creation business logic in backend/src/services/LeadService.ts"
Task T036: "Implement createLead API handler in backend/src/api/handlers/createLead.ts"
Task T037-T041: Complete remaining US1 tasks
Task T042: "Wire createLead handler to Express.js router in backend/src/api/routes.ts"
```

---

## Parallel Example: Foundational Phase

```bash
# Within Phase 2, many tasks can run in parallel:

# Database group (sequential within group):
Task T010-T013: Database migrations and connection pool

# Infrastructure (parallel - different files):
Task T014: Logger setup
Task T015: Config management
Task T016: Error handler middleware
Task T017: Dapr client

# Models (all parallel - different files):
Task T018: User model
Task T019: Lead model
Task T020: LeadScore model
Task T021: ActivityLog model

# Auth (parallel - different files):
Task T022: JWT middleware
Task T023: RBAC middleware

# Utilities (parallel - different files):
Task T024: Validation utilities
Task T025: Rate limiter

# Dapr components (all parallel - different files):
Task T026: Kafka Pub/Sub component
Task T027: Redis State Store component
Task T028: Secrets component
Task T029: Kubernetes namespace
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup ✅
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories) ✅
3. Complete Phase 3: User Story 1 (Create Lead) ✅
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Create leads via POST /api/v1/leads
   - Verify database records
   - Verify Kafka events published
   - Verify validation and duplicate detection
5. Deploy MVP to Minikube (local) or DOKS (production)
6. Demo to stakeholders

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational → Foundation ready ✅
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) 🎯
3. Add User Story 2 → Test independently → Deploy/Demo (Can now view leads)
4. Add User Story 3 → Test independently → Deploy/Demo (Can now update leads)
5. Add User Story 4 → Test independently → Deploy/Demo (AI qualification live)
6. Add User Story 5 → Test independently → Deploy/Demo (Full CRUD complete)
7. Add Kubernetes Deployment (Phase 8) → Production-ready
8. Add Polish (Phase 9) → Complete

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (required for all)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Create Lead) - MVP
   - **Developer B**: User Story 2 (View Leads)
   - **Developer C**: User Story 3 (Update Lead)
3. After US1-3 complete:
   - **Developer A**: User Story 4 (AI Qualification)
   - **Developer B**: User Story 5 (Delete Lead)
   - **Developer C**: Kubernetes Deployment (Phase 8)
4. Stories complete and integrate independently

---

## Task Counts

- **Phase 1 (Setup)**: 9 tasks
- **Phase 2 (Foundational)**: 23 tasks (BLOCKS all user stories)
- **Phase 3 (User Story 1)**: 10 tasks - MVP 🎯
- **Phase 4 (User Story 2)**: 11 tasks
- **Phase 5 (User Story 3)**: 12 tasks
- **Phase 6 (User Story 4)**: 16 tasks
- **Phase 7 (User Story 5)**: 8 tasks
- **Phase 8 (Kubernetes Deployment)**: 27 tasks
- **Phase 9 (Polish)**: 8 tasks

**Total**: 124 tasks

**Parallel opportunities**: 58 tasks marked [P] can run in parallel (47% of total)

---

## Notes

- **[P] tasks** = different files, no dependencies within phase, safe to parallelize
- **[Story] label** maps task to specific user story (US1-US5) for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Kubernetes architecture**: All services use Dapr sidecars for Pub/Sub, State Store, Secrets
- **Event streaming**: Redpanda (Kafka API) instead of AWS SNS/SQS
- **Database**: Neon DB (serverless PostgreSQL) with connection pooling
- **Observability**: Prometheus metrics, structured JSON logging, X-Ray tracing
- **Tests**: Not included (not explicitly requested in spec.md) - can be added in future iteration if TDD approach desired
