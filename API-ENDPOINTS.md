# Sales Lead Management API - Available Endpoints

## Base URL
```
http://localhost:3005
```

## Health Check Endpoints (No Authentication Required)

### Check System Health
```bash
GET http://localhost:3005/health
```
Returns detailed health status of database, Dapr, and features.

### Liveness Probe
```bash
GET http://localhost:3005/health/live
```
Kubernetes liveness probe - checks if service is alive.

### Readiness Probe
```bash
GET http://localhost:3005/health/ready
```
Kubernetes readiness probe - checks if service is ready to handle requests.

---

## API v1 Endpoints (Authentication Required)

**Base Path:** `/api/v1`

All API endpoints require authentication via Better Auth session token or JWT.

### Lead Management

#### 1. Create Lead
```bash
POST http://localhost:3005/api/v1/leads
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Corp",
  "phone": "+1234567890",
  "status": "new",
  "source": "website",
  "notes": "Interested in enterprise plan"
}
```

#### 2. List Leads (with filtering & pagination)
```bash
GET http://localhost:3005/api/v1/leads?status=new&page=1&limit=20&search=acme
Authorization: Bearer <token>
```

Query Parameters:
- `status` - Filter by status (new, contacted, qualified, unqualified)
- `search` - Search in name, email, company
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort field (createdAt, updatedAt, name)
- `sortOrder` - Sort direction (asc, desc)

#### 3. Get Single Lead
```bash
GET http://localhost:3005/api/v1/leads/:id
Authorization: Bearer <token>
```

#### 4. Update Lead
```bash
PATCH http://localhost:3005/api/v1/leads/:id
Content-Type: application/json
Authorization: Bearer <token>
If-Unmodified-Since: <last-modified-timestamp>

{
  "status": "contacted",
  "notes": "Follow-up scheduled for next week"
}
```

Supports optimistic locking with `If-Unmodified-Since` header.

#### 5. Delete Lead (Admin only)
```bash
DELETE http://localhost:3005/api/v1/leads/:id
Authorization: Bearer <token>
```

GDPR-compliant deletion with cascade to related records.

#### 6. AI Lead Qualification
```bash
POST http://localhost:3005/api/v1/leads/:id/qualify
Content-Type: application/json
Authorization: Bearer <token>

{
  "notes": "Additional context for AI qualification"
}
```

Triggers Claude API BANT (Budget, Authority, Need, Timeline) analysis.

---

## Authentication

### Better Auth Endpoints

**Base URL:** `http://localhost:3001/api/auth`

#### Sign Up
```bash
POST http://localhost:3001/api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

#### Sign In
```bash
POST http://localhost:3001/api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

Returns session token in response and sets cookie.

#### Get Session
```bash
GET http://localhost:3001/api/auth/get-session
```

#### Sign Out
```bash
POST http://localhost:3001/api/auth/sign-out
```

---

## Role-Based Access Control (RBAC)

- **Sales Rep** - Can only view/edit assigned leads
- **Manager** - Can view all leads, edit assigned leads
- **Admin** - Full access including delete operations

---

## Rate Limiting

- **Global Limit:** 100 requests per hour per IP
- **Strict Limit:** 10 requests per hour for write operations (POST)

---

## Testing with cURL

### Example: Create a lead
```bash
# First, get a session token by signing in through the frontend
# Then use the token:

curl -X POST http://localhost:3005/api/v1/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@company.com",
    "company": "Tech Corp",
    "phone": "+1555123456",
    "status": "new",
    "source": "referral"
  }'
```

### Example: List leads
```bash
curl -X GET "http://localhost:3005/api/v1/leads?status=new&limit=10" \
  -H "Authorization: Bearer <your-token>"
```

### Example: AI Qualification
```bash
curl -X POST http://localhost:3005/api/v1/leads/123/qualify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "notes": "Customer has $50k budget, talks to CTO weekly"
  }'
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "timestamp": "2026-01-13T07:18:50.569Z",
    "path": "/api/v1/leads",
    "requestId": "req-123"
  }
}
```

Common Error Codes:
- `NOT_FOUND` (404) - Resource not found
- `VALIDATION_ERROR` (400) - Invalid request data
- `AUTHENTICATION_ERROR` (401) - Not authenticated
- `AUTHORIZATION_ERROR` (403) - Insufficient permissions
- `CONFLICT` (409) - Optimistic lock conflict
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
