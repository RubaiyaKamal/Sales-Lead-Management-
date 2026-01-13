# Feature Specification: Lead Management with AI Qualification

**Feature Branch**: `001-lead-crud-ai`
**Created**: 2025-12-31
**Status**: Draft
**Input**: User description: "Lead CRUD with AI scoring"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Lead (Priority: P1)

A sales representative receives an inquiry from a potential customer (via website form, phone call, or email) and needs to immediately capture their information in the system to begin the qualification process.

**Why this priority**: Lead creation is the entry point for all sales activities. Without the ability to create leads, the system cannot function. This is the foundation upon which all other features depend.

**Independent Test**: Can be fully tested by submitting lead information through the API and verifying the lead appears in the database with all required fields populated and initial status set to "new".

**Acceptance Scenarios**:

1. **Given** a sales rep has contact information for a prospect, **When** they submit name, email, phone, company, and lead source through the create lead endpoint, **Then** the system creates a new lead record with a unique ID, sets status to "new", sets assigned_to to null (unassigned), assigns creation timestamp, and returns the complete lead object.

2. **Given** a lead is being created, **When** the email address already exists in the system, **Then** the system returns a validation error indicating duplicate email and suggests viewing the existing lead.

3. **Given** a sales rep submits lead information, **When** required fields (name, email, leadSource) are missing, **Then** the system returns a 400 error with specific validation messages for each missing field.

4. **Given** a lead is successfully created, **When** the creation completes, **Then** the system publishes a "lead.created" event to SNS for downstream processing (notifications, analytics).

---

### User Story 2 - View Lead Details and List (Priority: P2)

A sales manager needs to view all leads in the system, filter by status or source, search by name/company, and view detailed information for specific leads to monitor team performance and pipeline health.

**Why this priority**: Viewing leads is essential for sales teams to access information, follow up on prospects, and make data-driven decisions. This enables basic lead management workflows.

**Independent Test**: Can be fully tested by creating sample leads, then querying the list endpoint with various filters (status, source, date range) and verifying results match filter criteria. Test individual lead retrieval by ID.

**Acceptance Scenarios**:

1. **Given** there are 100 leads in the system, **When** a user requests the lead list with no filters, **Then** the system returns paginated results (20 per page by default) with lead summaries including id, name, email, company, status, lead score, and created date.

2. **Given** a user wants to find qualified leads, **When** they apply a status filter "qualified", **Then** the system returns only leads with qualification_status = "qualified", sorted by lead score (highest first).

3. **Given** a sales rep needs to view a specific lead, **When** they request GET /api/v1/leads/:id, **Then** the system returns the complete lead object including all fields, associated lead scores (BANT breakdown), and metadata.

4. **Given** a user searches for leads from a specific company, **When** they provide a search query "Acme Corp", **Then** the system returns all leads where company name contains "Acme Corp" (case-insensitive).

5. **Given** a user requests leads assigned to them, **When** they filter by assigned_to = current user ID, **Then** the system returns only leads assigned to that user, respecting role-based access control.

---

### User Story 3 - Update Lead Information (Priority: P3)

A sales representative needs to update lead information as they learn more about the prospect (correct spelling, update phone number, change assignment, update status after contact attempts).

**Why this priority**: Lead data quality is critical for effective sales follow-up. The ability to update information ensures accuracy and enables status progression through the sales funnel.

**Independent Test**: Can be fully tested by creating a lead, updating specific fields via PATCH endpoint, and verifying only modified fields change while others remain unchanged. Verify update timestamp changes.

**Acceptance Scenarios**:

1. **Given** a lead exists with status "new", **When** a sales rep updates the status to "contacted" and adds notes to metadata, **Then** the system updates only the specified fields, sets last_contacted_at to current timestamp, updates updated_at timestamp, and returns the updated lead object.

2. **Given** a lead is assigned to User A, **When** a manager reassigns it to User B, **Then** the system updates assigned_to field, publishes a "lead.updated" event, and sends a notification to User B about the new assignment.

3. **Given** a user attempts to update a lead they don't have permission to modify, **When** they submit a PATCH request, **Then** the system returns a 403 Forbidden error with message "You do not have permission to modify this lead".

4. **Given** a lead is being updated, **When** the user tries to change the email to an address already used by another lead, **Then** the system returns a 400 error indicating email conflict.

---

### User Story 4 - AI-Powered Lead Qualification (Priority: P4)

A sales rep engages in a conversation with a lead (via chat interface or manual qualification) and the AI system automatically analyzes responses to score the lead using BANT methodology (Budget, Authority, Need, Timeline), helping prioritize which leads to focus on.

**Why this priority**: AI qualification is the core differentiator of LeadFlow AI. It automates the qualification process, saves time, and provides objective scoring to identify high-value opportunities.

**Independent Test**: Can be fully tested by creating a lead, simulating a conversation with BANT-related responses, triggering AI qualification, and verifying lead_scores table is populated with budget_score, authority_score, need_score, timeline_score, reasoning, and total_score.

**Acceptance Scenarios**:

1. **Given** a new lead exists with no qualification score, **When** a sales rep triggers manual qualification via POST /api/v1/leads/:id/qualify, **Then** the system sends the lead data to Claude API with BANT scoring prompt, receives structured scoring response, creates a lead_scores record with individual scores (0-25 each) and reasoning, and updates the lead's qualification_status to "qualified" or "disqualified" based on total score threshold (≥60 = qualified).

2. **Given** a lead is being qualified, **When** the AI determines the lead has high budget (23/25), high authority (22/25), moderate need (15/25), and urgent timeline (24/25), **Then** the system calculates total_score = 84, sets qualification_status = "qualified", and publishes a "lead.qualified" event with high-value lead notification.

3. **Given** a lead score exists, **When** new information is learned and re-qualification is triggered, **Then** the system creates a new lead_scores record (preserving history), updates the lead to reference the latest score, and tracks score changes over time.

4. **Given** the Claude API is unavailable, **When** qualification is attempted, **Then** the system queues the qualification request in SQS (ai-processing-queue), returns a 202 Accepted response indicating async processing, and retries with exponential backoff (max 3 attempts before sending to DLQ).

5. **Given** a lead is qualified with a score ≥80, **When** the qualification completes, **Then** the system immediately notifies the assigned sales rep via SNS notification and creates a high-priority notification in the notifications table.

---

### User Story 5 - Delete Lead (Priority: P5)

A sales manager needs to delete leads that are duplicates, test data, or spam, or permanently remove leads upon GDPR data deletion request.

**Why this priority**: Data hygiene and GDPR compliance require the ability to remove leads. While less frequently used than other operations, it's essential for legal compliance and data quality.

**Independent Test**: Can be fully tested by creating a lead, deleting it via DELETE endpoint, and verifying the lead and all associated data (lead_scores, conversations, followups, notifications) are removed due to CASCADE delete constraints.

**Acceptance Scenarios**:

1. **Given** a lead exists with id "abc-123", **When** an authorized user sends DELETE /api/v1/leads/abc-123, **Then** the system deletes the lead record, cascades deletion to lead_scores, conversations, followups, and notifications, logs the deletion in activity_logs with user_id and timestamp, and returns 204 No Content.

2. **Given** a user without admin permissions attempts to delete a lead, **When** they send a DELETE request, **Then** the system returns 403 Forbidden with message "Only administrators can delete leads".

3. **Given** a lead has associated data (conversations, follow-ups), **When** the lead is deleted, **Then** the system ensures all related records are also deleted due to ON DELETE CASCADE foreign key constraints.

4. **Given** a GDPR data deletion request is received, **When** the system processes the request, **Then** it identifies all leads with the specified email, deletes all associated data, logs the deletion for audit purposes (retention: 7 years), and returns confirmation of complete data erasure.

---

### Edge Cases

- **What happens when a lead is created with an email in an invalid format?** System validates email format using regex and returns 400 error with message "Invalid email format".

- **What happens when two sales reps try to update the same lead simultaneously?** System uses optimistic locking based on updated_at timestamp; second update receives 409 Conflict error with message "Lead was modified by another user. Please refresh and try again."

- **What happens when the AI API returns an error during qualification?** System catches the error, queues the request for retry in SQS, logs the error to CloudWatch, and returns 202 Accepted indicating async processing.

- **What happens when a user requests a lead that doesn't exist?** System returns 404 Not Found with message "Lead not found".

- **What happens when pagination is requested beyond available results?** System returns empty results array with pagination metadata showing total pages and current page.

- **What happens when a lead score calculation results in values outside 0-25 range?** System enforces database CHECK constraints that reject invalid scores and logs validation error.

- **What happens when required secrets (Claude API key) are missing from Secrets Manager?** Lambda function fails to initialize, returns 500 error, and triggers CloudWatch alarm for immediate attention.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a REST API endpoint POST /api/v1/leads to create new leads with fields: name (required, max 255 chars), email (required, valid format), phone (optional, E.164 format), company (optional, max 255 chars), leadSource (required, enum: website, referral, ad, cold_outreach), metadata (optional, JSON object).

- **FR-002**: System MUST validate all lead creation inputs and return 400 Bad Request with specific field-level error messages for: missing required fields, invalid email format, invalid phone format, invalid leadSource enum value, and name/company exceeding max length.

- **FR-003**: System MUST enforce email uniqueness constraint at database level and return 400 error with message "Email already exists" if duplicate email is submitted during lead creation.

- **FR-004**: System MUST automatically set initial values for new leads: status = "new", qualification_status = "not_qualified", assigned_to = null (unassigned), created_at = current timestamp, updated_at = current timestamp, id = auto-generated UUID.

- **FR-005**: System MUST publish "lead.created" event to SNS topic (lead-events) after successful lead creation with payload containing lead id, name, email, leadSource, and assigned_to.

- **FR-006**: System MUST provide GET /api/v1/leads endpoint with query parameters: page (default 1), limit (default 20, max 100), status (filter), qualification_status (filter), leadSource (filter), assigned_to (filter), sortBy (default created_at), sortOrder (default desc), and search (text search on name/company/email).

- **FR-007**: System MUST return paginated lead list responses with structure: { data: Lead[], pagination: { page, limit, total, totalPages }, meta: { filters applied } }.

- **FR-008**: System MUST provide GET /api/v1/leads/:id endpoint that returns complete lead object including all fields from leads table plus nested leadScore object with BANT breakdown.

- **FR-009**: System MUST return 404 Not Found when requested lead ID does not exist, with error message "Lead not found".

- **FR-010**: System MUST provide PATCH /api/v1/leads/:id endpoint that accepts partial lead updates (only fields to be changed) and updates only specified fields while preserving others.

- **FR-011**: System MUST update updated_at timestamp to current time on every lead update operation.

- **FR-012**: System MUST set last_contacted_at timestamp to current time when lead status is changed to "contacted", "qualified", or "converted".

- **FR-013**: System MUST enforce role-based access control where sales reps can only update leads assigned to them, managers can update leads assigned to their team, and admins can update any lead.

- **FR-014**: System MUST publish "lead.updated" event to SNS topic after successful update with payload containing lead id, updated fields, previous values, and user_id who made the change.

- **FR-015**: System MUST provide POST /api/v1/leads/:id/qualify endpoint that triggers AI qualification using Anthropic Claude API with BANT scoring prompt.

- **FR-016**: System MUST send lead data to Claude API with system prompt that instructs the AI to: analyze lead information, ask BANT-related questions if conversing, or score existing BANT responses if qualifying, return structured JSON with scores (budget: 0-25, authority: 0-25, need: 0-25, timeline: 0-25), reasoning text, and confidence score (0.0-1.0).

- **FR-017**: System MUST create lead_scores record with: lead_id (FK to leads), budget_score, authority_score, need_score, timeline_score, total_score (computed as sum of 4 scores), reasoning (text from AI), and created_at timestamp.

- **FR-018**: System MUST update lead qualification_status to "qualified" if total_score ≥ 60, "disqualified" if total_score < 40, or "in_progress" if 40 ≤ total_score < 60.

- **FR-019**: System MUST publish "lead.qualified" event to SNS when qualification_status changes to "qualified", triggering notifications to assigned sales rep and manager.

- **FR-020**: System MUST handle Claude API errors gracefully by catching exceptions, queuing failed requests to SQS (ai-processing-queue) for retry, logging errors to CloudWatch, and returning 202 Accepted with message "Qualification queued for processing".

- **FR-021**: System MUST track AI API token usage in conversation metadata for cost monitoring and optimization.

- **FR-022**: System MUST provide DELETE /api/v1/leads/:id endpoint restricted to admin role only.

- **FR-023**: System MUST cascade delete all related records (lead_scores, conversations, followups, notifications, activity_logs) when a lead is deleted, using database ON DELETE CASCADE foreign key constraints.

- **FR-024**: System MUST log all lead deletions to activity_logs table with: lead_id, user_id (who deleted), action = "delete", description = "Lead permanently deleted", metadata = { reason, gdpr_request: true/false }, and created_at timestamp.

- **FR-025**: System MUST return 204 No Content on successful lead deletion with no response body.

- **FR-026**: System MUST validate JWT authentication token on all lead endpoints and return 401 Unauthorized if token is missing, expired, or invalid.

- **FR-027**: System MUST extract user_id from JWT token and use it for: assigning created_by field on lead creation, enforcing role-based access control, and logging activity.

- **FR-028**: System MUST implement rate limiting of 100 requests per hour per user for lead creation endpoint to prevent abuse.

- **FR-029**: System MUST cache lead list responses in Redis with 5-minute TTL, using cache key pattern: "leads:list:{filters hash}".

- **FR-030**: System MUST invalidate lead cache entries when leads are created, updated, or deleted to ensure data consistency.

- **FR-031**: System MUST use database connection pooling (max 100 connections) and parameterized queries to prevent SQL injection attacks.

- **FR-032**: System MUST encrypt PII fields (email, phone) at rest in database using AWS KMS encryption.

- **FR-033**: System MUST return structured error responses with format: { error: { code, message, details, timestamp } } for all error conditions.

- **FR-034**: System MUST instrument all Lambda functions with AWS X-Ray for distributed tracing, tagging traces with lead_id, user_id, and operation type.

- **FR-035**: System MUST emit CloudWatch custom metrics for: LeadCreated (count), LeadQualified (count), AIQualificationTime (milliseconds), and LeadOperationLatency (milliseconds per operation type).

- **FR-036**: System MUST automatically archive leads to cold storage (S3 Glacier) after 90 days of inactivity (no updates, no qualification attempts, no status changes), maintaining read-only access via separate archive query API while reducing hot storage costs.

- **FR-037**: System MUST allow managers and admins to manually assign leads to sales reps via PATCH /api/v1/leads/:id endpoint by updating assigned_to field, with new leads created in unassigned state (assigned_to = null) by default.

### Key Entities

- **Lead**: Represents a potential customer captured in the sales system. Attributes include unique identifier, contact information (name, email, phone), company name, lead source (origin of the lead), status (pipeline stage: new, contacted, qualified, unqualified, converted), qualification status (AI scoring state: not_qualified, in_progress, qualified, disqualified), assigned sales rep, metadata (custom fields, UTM parameters), and timestamps (created, updated, last contacted, converted).

- **LeadScore**: Represents AI-generated qualification scores for a lead using BANT methodology. Attributes include unique identifier, associated lead reference, budget score (0-25 points), authority score (0-25 points), need score (0-25 points), timeline score (0-25 points), total score (computed sum, 0-100), AI reasoning text explaining the scores, and creation timestamp. Relationship: Many LeadScores to one Lead (historical scoring).

- **User**: Represents a sales team member with system access. Attributes include unique identifier, email (login credential), name, role (admin, manager, sales_rep), Cognito sub (authentication reference), notification preferences, and timestamps. Relationship: One User to many Leads (assigned_to), One User creates/updates many Leads.

- **ActivityLog**: Represents audit trail of all actions performed on leads. Attributes include unique identifier, associated lead reference, user who performed action, action type (create, update, delete, qualify), description text, metadata (changed fields, previous values), and timestamp. Relationship: Many ActivityLogs to one Lead.

## Clarifications

### Session 2025-12-31

- Q: When a lead has been inactive (no updates, no qualification attempts) for an extended period, should the system automatically archive or purge old lead data? → A: 90 days - Archive inactive leads after 90 days to balance access and cost
- Q: When a new lead is created, how should the system assign it to a sales representative? → A: Manual assignment - Manager/admin assigns leads, new leads start unassigned

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sales reps can create a new lead in under 30 seconds from receiving prospect information, with 95% of lead creations succeeding on first attempt without validation errors.

- **SC-002**: Lead list queries return results in under 500ms at p95 latency for datasets up to 10,000 leads, supporting efficient lead management workflows.

- **SC-003**: AI qualification completes in under 3 seconds at p95 latency, providing near-instant lead scoring to enable rapid prioritization decisions.

- **SC-004**: System successfully processes 100 concurrent lead creation requests without errors or performance degradation, supporting team-wide usage during peak hours.

- **SC-005**: Zero data loss occurs during lead operations, with database transactions ensuring ACID compliance and cascade deletes properly cleaning up related records.

- **SC-006**: AI qualification accuracy reaches 85% agreement with manual sales rep qualification (validated against historical data), reducing manual qualification time by 70%.

- **SC-007**: Lead cache hit rate exceeds 70% for list queries, reducing database load and improving response times for frequently accessed data.

- **SC-008**: System maintains 99.9% API availability for lead endpoints, measured over rolling 30-day windows, ensuring reliable access for sales teams.

- **SC-009**: All lead operations comply with GDPR requirements, with data deletion requests processed within 24 hours and complete data erasure verified through audit logs.

- **SC-010**: Rate limiting prevents API abuse with zero false positives blocking legitimate users, while successfully blocking 100% of requests exceeding 100/hour threshold.

- **SC-011**: Sales managers can filter and search through 10,000+ leads to find specific prospects in under 10 seconds, improving lead follow-up efficiency.

- **SC-012**: System successfully handles Claude API failures with 100% of failed qualification requests queued for retry, and 95% succeeding within 3 retry attempts.

## Assumptions

- Sales reps have been trained on BANT qualification methodology and understand the scoring system
- AWS Cognito is already configured with user pools and JWT token validation
- Database schema (leads, lead_scores, users tables) matches the PostgreSQL schema defined in project documentation
- Claude API credentials are stored in AWS Secrets Manager and accessible to Lambda functions
- SNS topics (lead-events) and SQS queues (ai-processing-queue) are pre-configured by infrastructure stack
- Lead sources are limited to predefined enum values: website, referral, ad, cold_outreach (can be extended via configuration)
- Email addresses are used as unique identifiers for leads (business requirement to prevent duplicates)
- Phone numbers follow E.164 international format when provided
- Sales team roles (admin, manager, sales_rep) are defined in Cognito user attributes
- Cache invalidation latency of up to 5 minutes is acceptable for non-critical lead list views
- AI qualification is asynchronous and eventual consistency is acceptable (qualification results may not be immediate)
- Inactive leads (no activity for 90 days) will be automatically archived to cold storage to optimize costs while maintaining data retention for compliance
- New leads are created in unassigned state and require manual assignment by managers/admins (automatic assignment deferred to future phases)

## Out of Scope

- **Bulk lead import from CSV files**: Deferred to Phase 2, will be separate feature specification
- **Email follow-up automation**: Separate feature, will integrate with lead data but is not part of CRUD operations
- **WhatsApp messaging**: External communication feature, not part of core lead management
- **Conversation history tracking**: Part of chat feature specification, only referenced via foreign keys
- **Advanced analytics and reporting**: Dashboard feature, will consume lead data via read-only queries
- **Custom field configuration UI**: MVP uses metadata JSON field, custom field builder deferred to Phase 3
- **Lead deduplication merge tool**: Manual merge process, automated deduplication deferred
- **Lead scoring algorithm customization**: BANT weights (25 points each) are fixed in MVP, customization deferred
- **Multi-language support**: English only in MVP, i18n deferred to Phase 3
- **Mobile app**: Web-first MVP, mobile apps deferred to Phase 2
- **Integration with CRM systems (Salesforce, HubSpot)**: Third-party integrations deferred to Phase 3
- **Lead assignment automation based on rules**: Manual assignment in MVP, round-robin/territory routing deferred
- **Lead lifecycle stage transitions beyond status field**: Advanced pipeline customization deferred
- **Automated data enrichment from external sources**: MVP relies on manually entered data only

## Dependencies

- **AWS Cognito**: User authentication and JWT token validation
- **AWS Secrets Manager**: Anthropic API key storage and rotation
- **AWS RDS PostgreSQL**: Primary data storage with schema matching project documentation
- **AWS ElastiCache Redis**: Caching layer for lead list queries
- **AWS SNS**: Event publishing for lead lifecycle events
- **AWS SQS**: Async processing queue for AI qualification retries
- **AWS Lambda**: Serverless compute for API handlers
- **AWS API Gateway**: REST API routing and request validation
- **AWS X-Ray**: Distributed tracing and performance monitoring
- **AWS CloudWatch**: Logging, metrics, and alarms
- **Anthropic Claude API**: AI qualification and BANT scoring
- **Database migrations**: Initial schema must be applied before feature deployment
- **Infrastructure stack**: VPC, security groups, IAM roles must be deployed first
