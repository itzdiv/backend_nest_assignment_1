# Hiring Platform — Complete API Documentation

> **Base URL:** `http://localhost:3000/api`
>
> **Authentication:** Bearer JWT token in `Authorization` header
>
> **Server Port:** 3000 | **Global Prefix:** `/api`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication & Guards](#2-authentication--guards)
3. [Role & Permission Matrix](#3-role--permission-matrix)
4. [Status Lifecycle Transitions](#4-status-lifecycle-transitions)
5. [Pagination Format](#5-pagination-format)
6. [Error Codes](#6-error-codes)
7. [Database Indexes](#7-database-indexes)
8. [API Endpoints](#8-api-endpoints)
   - [8.1 Auth](#81-auth)
   - [8.2 Company](#82-company)
   - [8.3 Company Members](#83-company-members)
   - [8.4 Question Banks](#84-question-banks)
   - [8.5 Jobs (Company-Scoped)](#85-jobs-company-scoped)
   - [8.6 Jobs (Public Browsing)](#86-jobs-public-browsing)
   - [8.7 Candidate Profile](#87-candidate-profile)
   - [8.8 Resumes](#88-resumes)
   - [8.9 Applications (Candidate-Side)](#89-applications-candidate-side)
   - [8.10 Applications (Company-Side)](#810-applications-company-side)
   - [8.11 Application Comments](#811-application-comments)

---

## 1. Architecture Overview

```
Frontend (React/Next.js)
         │
         ▼
    NestJS Backend (Port 3000)
         │
    ┌────┴─────────────────┐
    │   Guards Chain        │
    │  JWT → Membership     │
    │       → Role          │
    └────┬─────────────────┘
         │
    Controller → Service → TypeORM Repository → PostgreSQL (Supabase)
```

**Stack:** NestJS v11, TypeScript 5.7, TypeORM 0.3.28, PostgreSQL, Zod v4.3.6, JWT + bcrypt

**Pattern:** Controller receives HTTP request → Zod validates body → Guards check auth/membership/role → Service executes business logic → Repository talks to DB → Response returned.

---

## 2. Authentication & Guards

### JWT Token

- Issued on login as `acess_token` (Bearer token).
- Payload: `{ user_id: string }`.
- Expiry: **7 days**.
- Attach to all protected requests: `Authorization: Bearer <token>`.

### Guard Chain (executed in order)

| Guard | What It Does | Sets On Request |
|-------|-------------|-----------------|
| **JwtAuthGuard** | Verifies JWT signature + expiry, fetches User from DB, checks `is_active` | `request.user` (full User entity) |
| **CompanyMembershipGuard** | Reads `:companyId` from URL, checks user has ACTIVE membership in that company | `request.membership` (CompanyMember entity with `role`) |
| **RoleGuard** | Reads `@Roles()` decorator metadata, checks `request.membership.role` is in allowed list | — |

**When are guards used?**

| Scenario | Guards Applied |
|----------|---------------|
| Public endpoints (browse jobs) | None |
| Candidate endpoints (profile, resumes, apply) | JwtAuthGuard only |
| Company read endpoints (list members, view apps) | JwtAuthGuard + CompanyMembershipGuard |
| Company write endpoints (create job, accept app) | JwtAuthGuard + CompanyMembershipGuard + RoleGuard |

---

## 3. Role & Permission Matrix

### Company Roles

| Role | Description | Who gets it |
|------|------------|-------------|
| `OWNER` | Full control. Can transfer ownership, delete company. | The user who created the company (auto-assigned). |
| `ADMIN` | Can manage members, jobs, question banks, applications. | Invited or promoted by OWNER. |
| `RECRUITER` | Can create jobs, manage applications, add comments. | Invited by OWNER or ADMIN. |

### Permission Matrix

| Action | OWNER | ADMIN | RECRUITER | Any Member | Candidate | Public |
|--------|-------|-------|-----------|------------|-----------|--------|
| Create Company | — | — | — | — | ✅ (any user) | — |
| View Company | — | — | — | ✅ | — | — |
| Update Company | ✅ | ✅ | — | — | — | — |
| Invite Member | ✅ | ✅ | — | — | — | — |
| List Members | — | — | — | ✅ | — | — |
| Update Member Role | ✅ | ✅ | — | — | — | — |
| Revoke Member | ✅ | ✅ | — | — | — | — |
| Transfer Ownership | ✅ | — | — | — | — | — |
| Create Question Bank | ✅ | ✅ | ✅ | — | — | — |
| Create Job | ✅ | ✅ | ✅ | — | — | — |
| List Company Jobs | — | — | — | ✅ | — | — |
| Update Job | ✅ | ✅ | ✅ | — | — | — |
| Change Job Status | ✅ | ✅ | ✅ | — | — | — |
| Delete Job (soft) | ✅ | ✅ | ✅ | — | — | — |
| Browse Public Jobs | — | — | — | — | — | ✅ |
| Apply to Job | — | — | — | — | ✅ | — |
| View Own Applications | — | — | — | — | ✅ | — |
| Withdraw Application | — | — | — | — | ✅ | — |
| View Company Applications | — | — | — | ✅ | — | — |
| Accept/Reject Application | ✅ | ✅ | ✅ | — | — | — |
| Add Comment | ✅ | ✅ | ✅ | — | — | — |
| View Comments | — | — | — | ✅ | — | — |

---

## 4. Status Lifecycle Transitions

### Member Status (`MemberStatus`)

```
                ┌──────────┐
   invite() →   │ INVITED  │   (default when someone is invited)
                └────┬─────┘
                     │  (currently auto-set to ACTIVE on invite in our system)
                     ▼
                ┌──────────┐
                │  ACTIVE  │   (can access company resources)
                └────┬─────┘
                     │  revokeMember()
                     ▼
                ┌──────────┐
                │ REVOKED  │   (blocked from accessing company)
                └──────────┘
```

**When does status change?**
- `INVITED` → Created when OWNER/ADMIN invites a user. In our current implementation, the member is immediately set to `ACTIVE` after invitation (no pending acceptance needed). A future enhancement could add an "accept invite" flow.
- `ACTIVE` → `REVOKED`: When OWNER/ADMIN revokes the member. The last OWNER cannot be revoked (protected by business logic).

### Job Status (`JobStatus`)

```
                ┌──────────┐
   create() →   │  DRAFT   │   (default — not visible to candidates)
                └────┬─────┘
                     │  updateStatus({ status: 'ACTIVE' })
                     ▼
                ┌──────────┐
                │  ACTIVE  │   (visible to candidates, accepting applications)
                └────┬─────┘
                     │  updateStatus({ status: 'CLOSED' })
                     │  OR auto-close when deadline passes
                     ▼
                ┌──────────┐
                │  CLOSED  │   (no longer accepting applications)
                └──────────┘
```

**Auto-close:** When `application_deadline` is set and the current time exceeds it, the system automatically closes the job before listing results (`autoCloseExpiredJobs`).

### Application Status (`ApplicationStatus`)

```
                ┌──────────┐
   apply() →    │ APPLIED  │   (default — candidate just submitted)
                └────┬─────┘
                     │
           ┌─────────┼──────────┐
           │         │          │
           ▼         ▼          ▼
      ┌─────────┐ ┌──────────┐ ┌───────────┐
      │ACCEPTED │ │ REJECTED │ │ WITHDRAWN │
      └─────────┘ └──────────┘ └───────────┘
       (company)   (company)    (candidate)
```

**Who can change what?**
- `APPLIED → ACCEPTED`: Company member (OWNER/ADMIN/RECRUITER) via `PATCH .../status`
- `APPLIED → REJECTED`: Company member (OWNER/ADMIN/RECRUITER) via `PATCH .../status`
- `APPLIED → WITHDRAWN`: Candidate only, via `PATCH .../withdraw`
- **Cannot withdraw** an `ACCEPTED` application.
- **Cannot update** a `WITHDRAWN` application.

### Job Visibility (`JobVisibility`)

| Value | Meaning |
|-------|---------|
| `PUBLIC` | Visible in `GET /api/v1/jobs` (public browse). Any visitor can see it. |
| `PRIVATE` | Only visible to company members via `GET /api/v1/companies/:companyId/jobs`. Used for internal positions or positions shared via direct link. |

### Application Mode (`ApplicationMode`)

| Value | Meaning | What Candidate Submits |
|-------|---------|----------------------|
| `STANDARD` | Resume-only application | `resume_id` (required) |
| `QUESTIONNAIRE` | Resume + screening questions | `resume_id` + `answers_json` |
| `VIDEO` | Resume + video | `resume_id` + `video_url` |

---

## 5. Pagination Format

All list endpoints support pagination via query parameters and return a consistent format.

**Query Parameters:**

| Param | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `page` | integer | 1 | 1 | — | Page number |
| `limit` | integer | 10 | 1 | 100 | Items per page |

**Response Shape:**

```json
{
  "data": [ ... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

## 6. Error Codes

| HTTP Code | Exception | When |
|-----------|-----------|------|
| `400` | BadRequestException | Validation fails, duplicate application, invalid state transition |
| `401` | UnauthorizedException | Missing/invalid/expired JWT token, inactive user |
| `403` | ForbiddenException | Not a company member, insufficient role, resume ownership mismatch |
| `404` | NotFoundException | Resource not found (job, company, member, application, profile, resume, question bank) |
| `409` | ConflictException | FK constraint violation (e.g., deleting resume used in application) |

**Error Response Shape:**

```json
{
  "statusCode": 400,
  "message": "You have already applied to this job",
  "error": "Bad Request"
}
```

---

## 7. Database Indexes

Indexes speed up queries by allowing the database to find rows without scanning the entire table. Here's every index in the system and **why** it exists:

### User Table (`users`)

| Column | Index Type | Why |
|--------|-----------|-----|
| `email` | UNIQUE + B-tree | Login lookup: `WHERE email = ?`. Also prevents duplicate registrations. |

### Company Members Table (`company_members`)

| Column(s) | Index Type | Why |
|-----------|-----------|-----|
| `(company_id, user_id)` | UNIQUE composite | Prevents same user being invited twice to the same company. Also speeds up membership lookups (guard queries). |
| `company_id` | B-tree | `WHERE company_id = ?` used by: list members, guard checks. |
| `user_id` | B-tree | `WHERE user_id = ?` used by: "my companies" queries. |

### Job Listings Table (`job_listings`)

| Column | Index Type | Why |
|--------|-----------|-----|
| `company_id` | B-tree | Filter jobs by company: `WHERE company_id = ?`. Used on every company job page. |
| `visibility` | B-tree | Public job browse: `WHERE visibility = 'PUBLIC'`. Avoids full table scan. |
| `status` | B-tree | Filter active jobs: `WHERE status = 'ACTIVE'`. Combined with visibility for public browse. |

### Job Applications Table (`job_applications`)

| Column(s) | Index Type | Why |
|-----------|-----------|-----|
| `(job_id, user_id)` | UNIQUE composite | **Critical**: Prevents duplicate applications. One application per user per job. |
| `job_id` | B-tree | List applications for a job: `WHERE job_id = ?`. |
| `company_id` | B-tree | List applications for company: `WHERE company_id = ?`. Denormalized to avoid joining `job_listings`. |
| `user_id` | B-tree | "My applications": `WHERE user_id = ?`. |
| `status` | B-tree | Filter by status: `WHERE status = 'APPLIED'`. |

### Application Comments Table (`application_comments`)

| Column | Index Type | Why |
|--------|-----------|-----|
| `job_application_id` | B-tree | Load comments for an application: `WHERE job_application_id = ?`. |
| `company_id` | B-tree | Denormalized. Filter comments by company without joining applications. |
| `user_id` | B-tree | Find comments by a specific team member. |

### Resumes Table (`resumes`)

| Column | Index Type | Why |
|--------|-----------|-----|
| `user_id` | B-tree | "My resumes": `WHERE user_id = ?`. Heavily filtered — candidates access their own resumes frequently. |

### Question Banks Table (`question_banks`)

| Column | Index Type | Why |
|--------|-----------|-----|
| `company_id` | B-tree | List question banks per company: `WHERE company_id = ?`. |

### Why Denormalized `company_id` in Applications & Comments?

The `job_applications` and `application_comments` tables have a `company_id` column even though the company can be derived by joining through `job_listings`. This is intentional:

- **Without denormalization:** `SELECT * FROM job_applications JOIN job_listings ON ... WHERE job_listings.company_id = ?` — requires a JOIN.
- **With denormalization:** `SELECT * FROM job_applications WHERE company_id = ?` — direct index scan, no JOIN.

Since company-scoped application queries happen on **every page load** of the recruiter dashboard, the denormalized index saves significant query time. The trade-off is a few extra bytes per row and maintaining consistency when a job moves companies (which never happens in this system).

---

## 8. API Endpoints

---

### 8.1 Auth

#### POST `/api/v1/auth/register`

**Description:** Register a new user account.

**Who uses this:** Anyone (unauthenticated). First step for both candidates and company creators.

**Guards:** None

**Frontend scenario:** User lands on the sign-up page, fills email + password, clicks "Create Account".

**Request Body:**

| Field | Type | Required | Constraints | Example |
|-------|------|----------|-------------|---------|
| `email` | string | ✅ | Must be valid email format | `"john@example.com"` |
| `password` | string | ✅ | Minimum 6 characters | `"securePass123"` |

**Example Request:**
```json
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePass123"
}
```

**Success Response (201):**
```json
{
  "message": "User Registered Sucessfully"
}
```

**Error Responses:**
| Code | Condition |
|------|-----------|
| `400` | Email already registered |
| `400` | Validation error (invalid email, password < 6 chars) |

---

#### POST `/api/v1/auth/login`

**Description:** Authenticate and receive a JWT token.

**Who uses this:** Registered users (candidates and company members).

**Guards:** None

**Frontend scenario:** User types email + password on the login page, clicks "Sign In". Frontend stores the returned token in localStorage/cookie and attaches it to all subsequent API calls.

**Request Body:**

| Field | Type | Required | Constraints | Example |
|-------|------|----------|-------------|---------|
| `email` | string | ✅ | Must be valid email | `"john@example.com"` |
| `password` | string | ✅ | Any string | `"securePass123"` |

**Example Request:**
```json
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePass123"
}
```

**Success Response (201):**
```json
{
  "acess_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
| Code | Condition |
|------|-----------|
| `401` | Invalid email or password |

---

### 8.2 Company

#### POST `/api/v1/companies`

**Description:** Create a new company. The creator automatically becomes the OWNER.

**Who uses this:** Any authenticated user who wants to start a company profile.

**Guards:** JwtAuthGuard

**Frontend scenario:** User clicks "Create Company" in the sidebar, fills in a form with company name/description/logo/website, submits. After creation, user is redirected to the company dashboard.

**Request Body:**

| Field | Type | Required | Constraints | Example |
|-------|------|----------|-------------|---------|
| `name` | string | ✅ | Min 2 characters | `"TechCorp"` |
| `description` | string | — | Free text | `"A leading tech company"` |
| `logo_url` | string | — | URL to logo image | `"https://cdn.example.com/logo.png"` |
| `website` | string | — | Company website URL | `"https://techcorp.com"` |

**Example Request:**
```json
POST /api/v1/companies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "TechCorp",
  "description": "A leading tech company specializing in AI",
  "logo_url": "https://cdn.example.com/techcorp-logo.png",
  "website": "https://techcorp.com"
}
```

**Success Response (201):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "TechCorp",
  "created_at": "2025-02-20T10:30:00.000Z"
}
```

**What happens internally:**
1. Company record created.
2. `company_members` row created with `role: OWNER`, `status: ACTIVE` for the creator.
3. Both happen inside a **transaction** (atomic — both succeed or both fail).

---

#### GET `/api/v1/companies/:companyId`

**Description:** Get company details.

**Who uses this:** Any ACTIVE member of the company.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Frontend scenario:** Company dashboard page loads and fetches company info to display name, logo, description.

**URL Params:**

| Param | Type | Description |
|-------|------|-------------|
| `companyId` | UUID | Company ID |

**Success Response (200):**
```json
{
  "id": "a1b2c3d4-...",
  "name": "TechCorp",
  "description": "A leading tech company specializing in AI",
  "logo_url": "https://cdn.example.com/techcorp-logo.png",
  "website": "https://techcorp.com",
  "deleted_at": null,
  "created_at": "2025-02-20T10:30:00.000Z",
  "updated_at": "2025-02-20T10:30:00.000Z"
}
```

---

#### PATCH `/api/v1/companies/:companyId`

**Description:** Update company profile. Partial update — only send fields you want to change.

**Who uses this:** OWNER or ADMIN of the company.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`

**Frontend scenario:** Company settings page — admin edits the company name or uploads a new logo.

**Request Body (all optional):**

| Field | Type | Constraints | Example |
|-------|------|-------------|---------|
| `name` | string | Min 2 chars | `"TechCorp Global"` |
| `description` | string | Free text | `"Updated description"` |
| `logo_url` | string | URL | `"https://cdn.example.com/new-logo.png"` |
| `website` | string | URL | `"https://techcorp.global"` |

**Success Response (200):** Returns the full updated company entity.

---

### 8.3 Company Members

#### POST `/api/v1/companies/:companyId/members/invite`

**Description:** Invite a registered user to join the company.

**Who uses this:** OWNER or ADMIN.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`

**Frontend scenario:** On the "Team" page, admin clicks "Invite Member", enters the user's email and selects a role from a dropdown (ADMIN or RECRUITER), clicks "Send Invite".

**Request Body:**

| Field | Type | Required | Possible Values | Example |
|-------|------|----------|----------------|---------|
| `email` | string | ✅ | Valid email of a registered user | `"recruiter@example.com"` |
| `role` | string | ✅ | `OWNER`, `ADMIN`, `RECRUITER` | `"RECRUITER"` |

**Example Request:**
```json
POST /api/v1/companies/a1b2c3d4-.../members/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "recruiter@example.com",
  "role": "RECRUITER"
}
```

**Success Response (201):**
```json
{
  "id": "membership-uuid-...",
  "email": "recruiter@example.com",
  "role": "RECRUITER",
  "status": "INVITED"
}
```

**Note:** In the current implementation, the invited member's status is set to `INVITED` but the `CompanyMembershipGuard` checks for `ACTIVE` status. This means the invited user needs their status to be manually set to `ACTIVE` (or the invite flow should be updated) before they can access company resources.

**Error Responses:**
| Code | Condition |
|------|-----------|
| `404` | User with that email not found (they must register first) |
| `400` | User is already a member of this company |

---

#### GET `/api/v1/companies/:companyId/members`

**Description:** List all company members with pagination.

**Who uses this:** Any ACTIVE company member.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Frontend scenario:** "Team" page shows a table of all members with their email, role, status, and join date.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page |

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "membership-uuid-...",
      "email": "owner@example.com",
      "role": "OWNER",
      "status": "ACTIVE",
      "created_at": "2025-02-20T10:30:00.000Z"
    },
    {
      "id": "membership-uuid-2-...",
      "email": "recruiter@example.com",
      "role": "RECRUITER",
      "status": "ACTIVE",
      "created_at": "2025-02-20T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

#### PATCH `/api/v1/companies/:companyId/members/:memberId/role`

**Description:** Change a member's role.

**Who uses this:** OWNER or ADMIN.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`

**Frontend scenario:** On the team page, clicking the role dropdown next to a member and selecting a new role.

**URL Params:**

| Param | Type | Description |
|-------|------|-------------|
| `companyId` | UUID | Company ID |
| `memberId` | UUID | Membership record ID (NOT user ID) |

**Request Body:**

| Field | Type | Required | Possible Values |
|-------|------|----------|----------------|
| `role` | string | ✅ | `OWNER`, `ADMIN`, `RECRUITER` |

**Business Rules:**
- Cannot downgrade the **last OWNER**. If only one OWNER exists and you try to change their role, you get `400: Cannot downgrade the last OWNER. Transfer ownership first.`

**Success Response (200):**
```json
{
  "id": "membership-uuid-...",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

---

#### PATCH `/api/v1/companies/:companyId/members/:memberId/revoke`

**Description:** Revoke a member's access (sets status to REVOKED).

**Who uses this:** OWNER or ADMIN.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`

**Frontend scenario:** Team page — clicking "Remove" button next to a member name. Confirmation dialog appears, then the member is revoked.

**Business Rules:**
- Cannot revoke the last OWNER.
- Revoked members cannot access any company endpoints (CompanyMembershipGuard blocks them).

**Success Response (200):**
```json
{
  "message": "Member revoked successfully"
}
```

---

#### PATCH `/api/v1/companies/:companyId/members/transfer/:memberId`

**Description:** Transfer company ownership to another ACTIVE member.

**Who uses this:** Only the current OWNER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`

**Frontend scenario:** In company settings, OWNER clicks "Transfer Ownership", selects a team member, confirms. The selected member becomes OWNER and the current owner becomes ADMIN.

**What happens (transaction):**
1. Target member → `role: OWNER`
2. Current owner → `role: ADMIN`
3. Both changes are atomic.

**Success Response (200):**
```json
{
  "message": "Ownership transferred successfully"
}
```

**Error Responses:**
| Code | Condition |
|------|-----------|
| `403` | Only OWNER can transfer ownership |
| `404` | Target member not found or not ACTIVE |

---

### 8.4 Question Banks

Question banks are reusable templates of screening questions. When a job listing is created with a `question_bank_id`, the questions are **snapshot-copied** into the job — editing the bank later doesn't affect existing jobs.

#### POST `/api/v1/companies/:companyId/question-banks`

**Description:** Create a new question bank.

**Who uses this:** OWNER, ADMIN, or RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** On the "Question Banks" page, recruiter clicks "New Template", adds questions via a form builder (question text, type, options), saves.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Human-readable label (min 2 chars) |
| `questions_json` | array | ✅ | Array of question objects (min 1 item) |

**Question Object Shape:**

| Field | Type | Required | Possible Values | Description |
|-------|------|----------|----------------|-------------|
| `id` | string | ✅ | Any non-empty string (UUID recommended) | Unique identifier for this question |
| `question` | string | ✅ | Any non-empty string | The question text |
| `category` | string | — | e.g. `"python"`, `"sql"`, `"behavioral"` | Grouping label |
| `type` | string | ✅ | `text`, `number`, `boolean`, `choice` | Answer type |
| `options` | string[] | — | Array of strings (required when type = `choice`) | Multiple choice options |
| `is_required` | boolean | — | `true` (default) or `false` | Whether candidate must answer |

**Example Request:**
```json
POST /api/v1/companies/a1b2.../question-banks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Backend Screening v1",
  "questions_json": [
    {
      "id": "q1",
      "question": "How many years of Node.js experience do you have?",
      "category": "experience",
      "type": "number",
      "is_required": true
    },
    {
      "id": "q2",
      "question": "What is your preferred backend framework?",
      "type": "choice",
      "options": ["Express", "NestJS", "Fastify", "Koa"],
      "is_required": true
    },
    {
      "id": "q3",
      "question": "Describe a challenging project you've worked on",
      "type": "text",
      "category": "behavioral",
      "is_required": false
    }
  ]
}
```

**Success Response (201):**
```json
{
  "id": "qb-uuid-...",
  "name": "Backend Screening v1",
  "questions_json": [ ... ],
  "created_at": "2025-02-20T12:00:00.000Z"
}
```

---

#### GET `/api/v1/companies/:companyId/question-banks`

**Description:** List all question banks for the company.

**Who uses this:** Any company member.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Query:** `?page=1&limit=10`

**Frontend scenario:** "Question Banks" sidebar section — shows list of templates with names, used when creating a new job listing.

---

#### GET `/api/v1/companies/:companyId/question-banks/:qbId`

**Description:** Get a single question bank with all questions.

**Who uses this:** Any company member.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Frontend scenario:** Clicking on a question bank name to view/edit its questions.

---

#### PATCH `/api/v1/companies/:companyId/question-banks/:qbId`

**Description:** Update a question bank (name and/or questions).

**Who uses this:** OWNER, ADMIN, RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Note:** Updating a question bank does NOT affect jobs that already snapshot-copied these questions. Only new jobs created after the update will use the new version.

---

### 8.5 Jobs (Company-Scoped)

#### POST `/api/v1/companies/:companyId/jobs`

**Description:** Create a new job listing.

**Who uses this:** OWNER, ADMIN, or RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** Recruiter clicks "Post New Job", fills a form (title, description, requirements, salary, location, employment type, application mode, visibility, deadline, question bank), clicks "Create". Job starts in DRAFT status by default.

**Request Body:**

| Field | Type | Required | Default | Possible Values | Description |
|-------|------|----------|---------|----------------|-------------|
| `title` | string | ✅ | — | Min 2 chars | Job title (e.g. "Senior Backend Engineer") |
| `description` | string | ✅ | — | Min 10 chars | Detailed job description |
| `requirements` | string | — | `null` | Free text | Skills, qualifications, etc. |
| `salary_range` | string | — | `null` | Max 100 chars | e.g. `"6-12 LPA"`, `"$80k-$120k"` |
| `location` | string | — | `null` | Max 255 chars | e.g. `"Remote"`, `"Bangalore"`, `"New York, NY"` |
| `employment_type` | string | — | `null` | Max 50 chars | e.g. `"FULL_TIME"`, `"INTERN"`, `"CONTRACT"`, `"PART_TIME"` |
| `application_mode` | string | — | `"STANDARD"` | `STANDARD`, `QUESTIONNAIRE`, `VIDEO` | How candidates apply |
| `visibility` | string | — | `"PUBLIC"` | `PUBLIC`, `PRIVATE` | Who can see this job |
| `status` | string | — | `"DRAFT"` | `DRAFT`, `ACTIVE`, `CLOSED` | Job lifecycle status |
| `application_deadline` | string | — | `null` | ISO 8601 datetime | e.g. `"2025-03-31T23:59:59Z"`. Jobs auto-close after this. |
| `question_bank_id` | string | — | `null` | Valid UUID | If provided, questions from this bank are **snapshot-copied** into the job |

**Example Request:**
```json
POST /api/v1/companies/a1b2.../jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Senior Backend Engineer",
  "description": "We are looking for an experienced backend engineer to join our team and build scalable APIs...",
  "requirements": "5+ years Node.js, TypeScript, PostgreSQL, Docker experience",
  "salary_range": "15-25 LPA",
  "location": "Bangalore (Hybrid)",
  "employment_type": "FULL_TIME",
  "application_mode": "QUESTIONNAIRE",
  "visibility": "PUBLIC",
  "status": "DRAFT",
  "application_deadline": "2025-04-30T23:59:59Z",
  "question_bank_id": "qb-uuid-..."
}
```

**Success Response (201):**
```json
{
  "id": "job-uuid-...",
  "title": "Senior Backend Engineer",
  "status": "DRAFT",
  "created_at": "2025-02-20T14:00:00.000Z"
}
```

**What happens with `question_bank_id`:**
1. System finds the question bank.
2. Deep copies `questions_json` into the job's `screening_questions_json`.
3. Future edits to the question bank do NOT affect this job.

---

#### GET `/api/v1/companies/:companyId/jobs`

**Description:** List all jobs for the company (including DRAFT and CLOSED).

**Who uses this:** Any company member.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Query:** `?page=1&limit=10`

**Frontend scenario:** "Jobs" tab in company dashboard — shows table of all jobs with title, status badge (Draft/Active/Closed), creation date.

**Note:** Before returning results, the system automatically closes any jobs whose `application_deadline` has passed.

---

#### GET `/api/v1/companies/:companyId/jobs/:jobId`

**Description:** Get full details of a single job.

**Who uses this:** Any company member.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Frontend scenario:** Clicking a job row to see full description, screening questions, deadline, and application stats.

**Response:** Full job entity with all fields including `screening_questions_json`.

---

#### PATCH `/api/v1/companies/:companyId/jobs/:jobId`

**Description:** Update job details. Partial update — send only fields to change.

**Who uses this:** OWNER, ADMIN, RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** Edit job page — recruiter updates salary range, adds requirements, changes location.

**Request Body:** Same fields as POST, all optional.

---

#### PATCH `/api/v1/companies/:companyId/jobs/:jobId/status`

**Description:** Change job lifecycle status.

**Who uses this:** OWNER, ADMIN, RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** During a button click: "Publish" (DRAFT→ACTIVE), "Close Hiring" (ACTIVE→CLOSED), "Reopen" (CLOSED→ACTIVE).

**Request Body:**

| Field | Type | Required | Possible Values |
|-------|------|----------|----------------|
| `status` | string | ✅ | `DRAFT`, `ACTIVE`, `CLOSED` |

**Example Request:**
```json
PATCH /api/v1/companies/a1b2.../jobs/job-uuid.../status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

**Success Response (200):**
```json
{
  "id": "job-uuid-...",
  "title": "Senior Backend Engineer",
  "status": "ACTIVE"
}
```

---

#### DELETE `/api/v1/companies/:companyId/jobs/:jobId`

**Description:** Soft-delete a job (sets `deleted_at` timestamp). The job is not physically removed.

**Who uses this:** OWNER, ADMIN, RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** "Delete Job" option in job settings. After deletion, job disappears from all listings but data is preserved for audit.

**Success Response (200):**
```json
{
  "message": "Job deleted successfully"
}
```

---

### 8.6 Jobs (Public Browsing)

#### GET `/api/v1/jobs`

**Description:** Browse all PUBLIC + ACTIVE jobs across all companies.

**Who uses this:** **Anyone** — no authentication required. This is the candidate-facing job board.

**Guards:** None

**Frontend scenario:** The homepage or "Browse Jobs" page. Shows a paginated list of all open positions with company name, title, salary, location.

**Query:** `?page=1&limit=10`

**Filters applied automatically:**
- `visibility = PUBLIC`
- `status = ACTIVE`
- `deleted_at IS NULL`

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "job-uuid-...",
      "title": "Senior Backend Engineer",
      "description": "We are looking for...",
      "requirements": "5+ years Node.js...",
      "salary_range": "15-25 LPA",
      "location": "Bangalore (Hybrid)",
      "employment_type": "FULL_TIME",
      "application_mode": "QUESTIONNAIRE",
      "application_deadline": "2025-04-30T23:59:59.000Z",
      "company_name": "TechCorp",
      "created_at": "2025-02-20T14:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**What candidates see:**
- Job title, description, requirements, salary, location, employment type
- Application mode (so frontend knows which form to show)
- Application deadline (so frontend can show "X days left")
- Company name (for branding)
- **NOT shown:** company internal data, private jobs, draft/closed jobs

---

### 8.7 Candidate Profile

#### POST `/api/v1/candidate/profile`

**Description:** Create a candidate profile (one per user).

**Who uses this:** Authenticated user wanting to apply for jobs.

**Guards:** JwtAuthGuard

**Frontend scenario:** After login, if the user doesn't have a profile, they're prompted to fill one out (name, bio, links, phone). This is required context for recruiters reviewing applications.

**Request Body:**

| Field | Type | Required | Constraints | Example |
|-------|------|----------|-------------|---------|
| `full_name` | string | ✅ | Min 2 chars | `"John Doe"` |
| `bio` | string | — | Free text | `"Full-stack developer with 5 years experience"` |
| `photo_url` | string | — | URL to profile photo | `"https://cdn.example.com/photo.jpg"` |
| `linkedin_url` | string | — | LinkedIn profile URL | `"https://linkedin.com/in/johndoe"` |
| `portfolio_url` | string | — | Portfolio website | `"https://johndoe.dev"` |
| `phone` | string | — | Max 50 chars | `"+91-9876543210"` |

**Success Response (201):** Returns the full profile entity.

**Error:** `400` if profile already exists (use PATCH to update).

---

#### GET `/api/v1/candidate/profile`

**Description:** Get the authenticated user's candidate profile.

**Who uses this:** Candidate (to view their own profile).

**Guards:** JwtAuthGuard

**Frontend scenario:** Profile settings page — pre-fills form fields with existing data.

**Error:** `404` if no profile exists yet.

---

#### PATCH `/api/v1/candidate/profile`

**Description:** Update candidate profile (partial update).

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Frontend scenario:** Profile settings — user edits their bio or adds LinkedIn.

**Request Body:** Same fields as POST, all optional.

---

### 8.8 Resumes

#### POST `/api/v1/candidate/resumes`

**Description:** Upload a new resume.

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Frontend scenario:** On "My Resumes" page, candidate clicks "Upload Resume", provides a title and file URL (uploaded to cloud storage first, then URL passed here). Can mark as primary.

**Request Body:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | — | `null` | Human-readable label (e.g. "Backend Resume 2025") |
| `file_url` | string | ✅ | — | URL to the uploaded file (PDF/DOC) |
| `is_primary` | boolean | — | `false` | If `true`, all other resumes are demoted (transaction) |

**Note on `is_primary`:** Only ONE resume per user can be primary. When `is_primary: true` is sent, the system runs a transaction: (1) set all user's other resumes to `is_primary = false`, (2) create new resume with `is_primary = true`.

**Success Response (201):** Returns the created resume entity.

---

#### GET `/api/v1/candidate/resumes`

**Description:** List all resumes for the authenticated user.

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Query:** `?page=1&limit=10`

**Frontend scenario:** "My Resumes" page — shows list with title, file link, primary badge.

---

#### PATCH `/api/v1/candidate/resumes/:resumeId/primary`

**Description:** Set a specific resume as the primary one.

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Frontend scenario:** Click "Set as Primary" button next to a resume. The star/badge moves to this resume.

**Transaction steps:**
1. Verify resume exists and belongs to user.
2. Set ALL user's resumes to `is_primary = false`.
3. Set selected resume to `is_primary = true`.

**Success Response (200):** Returns the updated resume entity.

---

#### DELETE `/api/v1/candidate/resumes/:resumeId`

**Description:** Delete a resume.

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Frontend scenario:** "Delete" button on a resume card. Confirmation dialog first.

**Business Rules:**
- Validates ownership (only your own resumes).
- If the resume is referenced by a `job_application`, deletion fails with `409 Conflict`.

**Success Response (200):**
```json
{
  "message": "Resume deleted successfully"
}
```

**Error Responses:**
| Code | Condition |
|------|-----------|
| `404` | Resume not found or doesn't belong to you |
| `409` | Resume is used in one or more job applications |

---

### 8.9 Applications (Candidate-Side)

#### POST `/api/v1/candidate/applications`

**Description:** Apply to a job.

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Frontend scenario:** On a job detail page, candidate clicks "Apply Now", selects a resume from their list, optionally fills screening questions (if QUESTIONNAIRE mode) or provides video URL (if VIDEO mode), clicks "Submit Application".

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | UUID | ✅ | The job to apply to (must be ACTIVE, not expired) |
| `resume_id` | UUID | ✅ | Resume to attach (must belong to the user) |
| `answers_json` | any | — | JSON answers to screening questions (for QUESTIONNAIRE mode) |
| `video_url` | string | — | Video URL (for VIDEO mode applications) |

**`answers_json` shape** (matches job's `screening_questions_json`):
```json
{
  "q1": 5,
  "q2": "NestJS",
  "q3": "I built a real-time analytics dashboard..."
}
```
Keys match question `id`s from the job's screening questions.

**Example Request:**
```json
POST /api/v1/candidate/applications
Authorization: Bearer <token>
Content-Type: application/json

{
  "job_id": "job-uuid-...",
  "resume_id": "resume-uuid-...",
  "answers_json": {
    "q1": 5,
    "q2": "NestJS"
  }
}
```

**Success Response (201):**
```json
{
  "id": "application-uuid-...",
  "job_id": "job-uuid-...",
  "status": "APPLIED",
  "created_at": "2025-02-20T15:00:00.000Z"
}
```

**Validation checks (in order):**
1. Job exists, is ACTIVE, not soft-deleted.
2. Application deadline hasn't passed.
3. Resume belongs to the applying user.
4. User hasn't already applied to this job (`UNIQUE(job_id, user_id)`).

**Error Responses:**
| Code | Condition |
|------|-----------|
| `404` | Job not found or not accepting applications |
| `400` | Application deadline has passed |
| `403` | Resume not found or doesn't belong to you |
| `400` | You have already applied to this job |

---

#### GET `/api/v1/candidate/applications`

**Description:** View all applications submitted by the authenticated candidate.

**Who uses this:** Candidate.

**Guards:** JwtAuthGuard

**Query:** `?page=1&limit=10`

**Frontend scenario:** "My Applications" page — shows a list of all jobs applied to, with status badges (Applied, Accepted, Rejected, Withdrawn), company names, and recruiter comments (only those marked visible_to_candidate).

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "app-uuid-...",
      "status": "APPLIED",
      "answers_json": { "q1": 5, "q2": "NestJS" },
      "video_url": null,
      "applied_at": "2025-02-20T15:00:00.000Z",
      "last_updated_at": "2025-02-20T15:00:00.000Z",
      "job": {
        "id": "job-uuid-...",
        "title": "Senior Backend Engineer",
        "company_name": "TechCorp"
      },
      "comments": [
        {
          "id": "comment-uuid-...",
          "comment": "Great profile! We'd like to schedule an interview.",
          "created_at": "2025-02-21T10:00:00.000Z"
        }
      ]
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

**Note on comments:** Only comments where `visible_to_candidate = true` are shown. Internal team notes are hidden.

---

#### PATCH `/api/v1/candidate/applications/:applicationId/withdraw`

**Description:** Withdraw an application.

**Who uses this:** Candidate (only the one who applied).

**Guards:** JwtAuthGuard

**Frontend scenario:** "Withdraw Application" button with confirmation dialog. Useful when candidate found another opportunity.

**Business Rules:**
- Cannot withdraw if status is `ACCEPTED`.
- Cannot withdraw if already `WITHDRAWN`.

**Success Response (200):**
```json
{
  "message": "Application withdrawn successfully"
}
```

---

### 8.10 Applications (Company-Side)

#### GET `/api/v1/companies/:companyId/applications`

**Description:** View all applications received by the company across all its jobs.

**Who uses this:** Any company member.

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Query:** `?page=1&limit=10`

**Frontend scenario:** "Applications" tab in company dashboard — shows table with candidate email, job title, status, resume link, comment count.

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "app-uuid-...",
      "status": "APPLIED",
      "answers_json": { "q1": 5 },
      "video_url": null,
      "created_at": "2025-02-20T15:00:00.000Z",
      "updated_at": "2025-02-20T15:00:00.000Z",
      "candidate_email": "candidate@example.com",
      "job_title": "Senior Backend Engineer",
      "resume_url": "https://cdn.example.com/resume.pdf",
      "comments_count": 2
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

#### PATCH `/api/v1/companies/:companyId/applications/:applicationId/status`

**Description:** Accept or reject a candidate's application.

**Who uses this:** OWNER, ADMIN, RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** Viewing an application detail, recruiter clicks "Accept" or "Reject" button.

**Request Body:**

| Field | Type | Required | Possible Values |
|-------|------|----------|----------------|
| `status` | string | ✅ | `ACCEPTED`, `REJECTED` |

**Business Rules:**
- Cannot update a `WITHDRAWN` application.
- Records `status_changed_by` (the user who made the change).

**Example Request:**
```json
PATCH /api/v1/companies/a1b2.../applications/app-uuid.../status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACCEPTED"
}
```

**Success Response (200):**
```json
{
  "id": "app-uuid-...",
  "status": "ACCEPTED",
  "updated_at": "2025-02-21T14:00:00.000Z"
}
```

---

### 8.11 Application Comments

Comments allow company members to leave internal notes or candidate-visible feedback on applications.

#### POST `/api/v1/companies/:companyId/applications/:applicationId/comments`

**Description:** Add a comment to an application.

**Who uses this:** OWNER, ADMIN, RECRUITER.

**Guards:** JwtAuthGuard + CompanyMembershipGuard + RoleGuard

**Roles:** `OWNER`, `ADMIN`, `RECRUITER`

**Frontend scenario:** On the application detail view, recruiter types a note in the comments section and optionally toggles "Visible to candidate". Internal notes (default) are for team discussion; visible notes can be used as feedback to the candidate.

**Request Body:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `comment` | string | ✅ | — | Comment text (min 1 character) |
| `visible_to_candidate` | boolean | — | `false` | If `true`, candidate can see this comment in "My Applications" |

**Example Request:**
```json
POST /api/v1/companies/a1b2.../applications/app-uuid.../comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "Strong technical background. Schedule for round 2.",
  "visible_to_candidate": false
}
```

**Success Response (201):**
```json
{
  "id": "comment-uuid-...",
  "comment": "Strong technical background. Schedule for round 2.",
  "visible_to_candidate": false,
  "created_at": "2025-02-21T10:00:00.000Z"
}
```

---

#### GET `/api/v1/companies/:companyId/applications/:applicationId/comments`

**Description:** View all comments on an application.

**Who uses this:** Any company member (all comments are visible to the team, regardless of `visible_to_candidate`).

**Guards:** JwtAuthGuard + CompanyMembershipGuard

**Frontend scenario:** Application detail page — comments section shows all team notes with the commenter's email and timestamp.

**Success Response (200):**
```json
[
  {
    "id": "comment-uuid-1-...",
    "comment": "Strong technical background. Schedule for round 2.",
    "visible_to_candidate": false,
    "user_email": "recruiter@techcorp.com",
    "created_at": "2025-02-21T10:00:00.000Z"
  },
  {
    "id": "comment-uuid-2-...",
    "comment": "Great profile! We'd like to schedule an interview.",
    "visible_to_candidate": true,
    "user_email": "admin@techcorp.com",
    "created_at": "2025-02-21T11:00:00.000Z"
  }
]
```

**Note:** This endpoint returns ALL comments (both internal and candidate-visible). The `visible_to_candidate` flag is informational for the team. The candidate's own `GET /api/v1/candidate/applications` only shows comments where `visible_to_candidate = true`.

---

## Entity Field Reference

### BaseEntity (inherited by all entities)

| Column | Type | Auto | Description |
|--------|------|------|-------------|
| `id` | UUID | ✅ Auto-generated | Primary key |
| `created_at` | timestamptz | ✅ Auto-set on insert | Creation timestamp |
| `updated_at` | timestamptz | ✅ Auto-updated | Last modification timestamp |

### User

| Column | Type | Nullable | Indexed | Description |
|--------|------|----------|---------|-------------|
| `email` | varchar(255) | NO | UNIQUE | User's email address |
| `password_hash` | text | NO | — | bcrypt-hashed password |
| `is_active` | boolean | NO | — | Default `true`. Set to `false` to disable account. |
| `is_email_verified` | boolean | NO | — | Default `false`. For future email verification flow. |

### CandidateProfile

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `user_id` | FK → users | NO | OneToOne with User. Each user has at most one profile. |
| `full_name` | varchar(255) | NO | Candidate's full name |
| `bio` | text | YES | Short professional summary |
| `photo_url` | text | YES | URL to profile photo (cloud-hosted) |
| `linkedin_url` | text | YES | LinkedIn profile URL |
| `portfolio_url` | text | YES | Personal website/portfolio |
| `phone` | varchar(50) | YES | Contact phone number |

### Resume

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `user_id` | FK → users | NO | Owner of this resume |
| `title` | varchar(255) | YES | Label like "Backend Resume 2025" |
| `file_url` | text | NO | URL to the uploaded file (S3, Supabase Storage, etc.) |
| `is_primary` | boolean | NO | Default `false`. Only one per user can be `true`. |

### Company

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `name` | varchar(255) | NO | Company display name |
| `description` | text | YES | Company bio/about |
| `logo_url` | text | YES | URL to company logo |
| `website` | text | YES | Company website |
| `deleted_at` | timestamptz | YES | Soft delete. If not null, company is considered deleted. |

### CompanyMember

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `company_id` | FK → companies | NO | Which company this membership is for |
| `user_id` | FK → users | NO | Which user this membership is for |
| `role` | ENUM | NO | `OWNER`, `ADMIN`, `RECRUITER` |
| `status` | ENUM | NO | `ACTIVE`, `INVITED`, `REVOKED`. Default: `ACTIVE`. |
| `invited_by` | FK → users | YES | Who sent the invite (`null` for self-created OWNER). |

### QuestionBank

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `company_id` | FK → companies | NO | Owning company |
| `created_by` | FK → users | YES | Who created this bank. `SET NULL` on user delete. |
| `name` | varchar(255) | NO | Human-readable label |
| `questions_json` | JSONB | NO | Array of question objects (see Question Banks section) |

### JobListing

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `company_id` | FK → companies | NO | Which company owns this job |
| `created_by` | FK → users | YES | Who posted the job |
| `title` | varchar(255) | NO | Job title |
| `description` | text | NO | Full job description |
| `requirements` | text | YES | Skills/qualifications needed |
| `salary_range` | varchar(100) | YES | e.g. "15-25 LPA" |
| `location` | varchar(255) | YES | e.g. "Remote", "Bangalore" |
| `employment_type` | varchar(50) | YES | e.g. "FULL_TIME", "INTERN" |
| `application_mode` | ENUM | NO | `STANDARD`, `QUESTIONNAIRE`, `VIDEO`. Default: `STANDARD`. |
| `visibility` | ENUM | NO | `PUBLIC`, `PRIVATE`. Default: `PUBLIC`. |
| `status` | ENUM | NO | `DRAFT`, `ACTIVE`, `CLOSED`. Default: `DRAFT`. |
| `application_deadline` | timestamptz | YES | When applications close. Jobs auto-close after this. |
| `screening_questions_json` | JSONB | YES | Snapshot-copied from question bank at creation time. |
| `deleted_at` | timestamptz | YES | Soft delete timestamp. |

### JobApplication

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `job_id` | FK → job_listings | NO | Which job this application is for |
| `company_id` | FK → companies | NO | Denormalized for fast company-scoped queries |
| `user_id` | FK → users | NO | Candidate who applied |
| `resume_id` | FK → resumes | YES | Resume attached. `SET NULL` on resume delete. |
| `answers_json` | JSONB | YES | Candidate's answers to screening questions |
| `video_url` | text | YES | Video submission URL |
| `status` | ENUM | NO | `APPLIED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`. Default: `APPLIED`. |
| `status_changed_by` | FK → users | YES | Who last changed the status (recruiter) |

### ApplicationComment

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `job_application_id` | FK → job_applications | NO | Which application this comment is on |
| `company_id` | FK → companies | NO | Denormalized company reference |
| `user_id` | FK → users | YES | Who wrote the comment. `SET NULL` on user delete. |
| `comment` | text | NO | The comment text |
| `visible_to_candidate` | boolean | NO | Default `false`. If `true`, candidate sees this. |

---

## Complete Endpoint Summary

| # | Method | URL | Auth | Roles | Description |
|---|--------|-----|------|-------|-------------|
| 1 | POST | `/api/v1/auth/register` | — | — | Register new user |
| 2 | POST | `/api/v1/auth/login` | — | — | Login, get JWT |
| 3 | POST | `/api/v1/companies` | JWT | — | Create company (become OWNER) |
| 4 | GET | `/api/v1/companies/:companyId` | JWT+Membership | Any member | View company details |
| 5 | PATCH | `/api/v1/companies/:companyId` | JWT+Membership+Role | OWNER, ADMIN | Update company |
| 6 | POST | `/api/v1/companies/:companyId/members/invite` | JWT+Membership+Role | OWNER, ADMIN | Invite member |
| 7 | GET | `/api/v1/companies/:companyId/members` | JWT+Membership | Any member | List members |
| 8 | PATCH | `/api/v1/companies/:companyId/members/:memberId/role` | JWT+Membership+Role | OWNER, ADMIN | Change role |
| 9 | PATCH | `/api/v1/companies/:companyId/members/:memberId/revoke` | JWT+Membership+Role | OWNER, ADMIN | Revoke member |
| 10 | PATCH | `/api/v1/companies/:companyId/members/transfer/:memberId` | JWT+Membership+Role | OWNER | Transfer ownership |
| 11 | POST | `/api/v1/companies/:companyId/question-banks` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Create question bank |
| 12 | GET | `/api/v1/companies/:companyId/question-banks` | JWT+Membership | Any member | List question banks |
| 13 | GET | `/api/v1/companies/:companyId/question-banks/:qbId` | JWT+Membership | Any member | View question bank |
| 14 | PATCH | `/api/v1/companies/:companyId/question-banks/:qbId` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Update question bank |
| 15 | POST | `/api/v1/companies/:companyId/jobs` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Create job |
| 16 | GET | `/api/v1/companies/:companyId/jobs` | JWT+Membership | Any member | List company jobs |
| 17 | GET | `/api/v1/companies/:companyId/jobs/:jobId` | JWT+Membership | Any member | View job details |
| 18 | PATCH | `/api/v1/companies/:companyId/jobs/:jobId` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Update job |
| 19 | PATCH | `/api/v1/companies/:companyId/jobs/:jobId/status` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Change job status |
| 20 | DELETE | `/api/v1/companies/:companyId/jobs/:jobId` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Soft-delete job |
| 21 | GET | `/api/v1/jobs` | — | — | Browse public active jobs |
| 22 | POST | `/api/v1/candidate/profile` | JWT | — | Create candidate profile |
| 23 | GET | `/api/v1/candidate/profile` | JWT | — | View own profile |
| 24 | PATCH | `/api/v1/candidate/profile` | JWT | — | Update own profile |
| 25 | POST | `/api/v1/candidate/resumes` | JWT | — | Upload resume |
| 26 | GET | `/api/v1/candidate/resumes` | JWT | — | List own resumes |
| 27 | PATCH | `/api/v1/candidate/resumes/:resumeId/primary` | JWT | — | Set resume as primary |
| 28 | DELETE | `/api/v1/candidate/resumes/:resumeId` | JWT | — | Delete resume |
| 29 | POST | `/api/v1/candidate/applications` | JWT | — | Apply to a job |
| 30 | GET | `/api/v1/candidate/applications` | JWT | — | View own applications |
| 31 | PATCH | `/api/v1/candidate/applications/:applicationId/withdraw` | JWT | — | Withdraw application |
| 32 | GET | `/api/v1/companies/:companyId/applications` | JWT+Membership | Any member | View company applications |
| 33 | PATCH | `/api/v1/companies/:companyId/applications/:applicationId/status` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Accept/reject app |
| 34 | POST | `/api/v1/companies/:companyId/applications/:applicationId/comments` | JWT+Membership+Role | OWNER, ADMIN, RECRUITER | Add comment |
| 35 | GET | `/api/v1/companies/:companyId/applications/:applicationId/comments` | JWT+Membership | Any member | View comments |

**Total: 35 endpoints**

---

## Ideal End-to-End User Flow

### Company Side (Recruiter Journey)

```
1. Register account          POST /api/v1/auth/register
2. Login                     POST /api/v1/auth/login       → save token
3. Create company            POST /api/v1/companies
4. Invite team members       POST /api/v1/companies/:id/members/invite
5. Create question bank      POST /api/v1/companies/:id/question-banks
6. Post a job (DRAFT)        POST /api/v1/companies/:id/jobs
7. Publish the job           PATCH /api/v1/companies/:id/jobs/:jid/status  { status: "ACTIVE" }
8. Wait for applications...
9. View applications         GET /api/v1/companies/:id/applications
10. Add internal notes       POST /api/v1/companies/:id/applications/:aid/comments
11. Accept/reject            PATCH /api/v1/companies/:id/applications/:aid/status
12. Send feedback            POST .../comments { visible_to_candidate: true }
```

### Candidate Side (Job Seeker Journey)

```
1. Register account          POST /api/v1/auth/register
2. Login                     POST /api/v1/auth/login       → save token
3. Create profile            POST /api/v1/candidate/profile
4. Upload resume             POST /api/v1/candidate/resumes
5. Browse jobs               GET /api/v1/jobs               (no auth needed)
6. Apply to a job            POST /api/v1/candidate/applications
7. Track applications        GET /api/v1/candidate/applications
8. Read recruiter feedback   (visible comments appear in step 7 response)
9. Withdraw if needed        PATCH /api/v1/candidate/applications/:aid/withdraw
```
