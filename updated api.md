# Updated API (Implementation-Verified)

**Generated on:** 2026-03-13  
**Compared:** `API_DOCUMENTATION.md` vs actual controller code in `src/api/controllers`

---

## 1) Audit Summary

- Existing documentation lists **35** endpoints.
- Current implementation exposes **37** endpoints.
- Found:
  - **2 new endpoints** (not present in `API_DOCUMENTATION.md`)
  - **4 changed endpoints** (path/method or request contract changed)

---

## 2) Changed Endpoints (Breaking/Behavior Changes)

### A) Invite Member route changed

- **Documented:** `POST /api/v1/companies/:companyId/members/invite`
- **Implemented:** `POST /api/v1/companies/:companyId/members`
- **Controller:** `MemberController.inviteMember`
- **Impact:** Frontend/clients using `/invite` will now get `404`.

---

### B) Revoke Member method/path changed

- **Documented:** `PATCH /api/v1/companies/:companyId/members/:memberId/revoke`
- **Implemented:** `DELETE /api/v1/companies/:companyId/members/:memberId`
- **Controller:** `MemberController.revokeMember`
- **Impact:** Must switch from `PATCH` to `DELETE` and remove `/revoke` suffix.

---

### C) Transfer Ownership method/path changed

- **Documented:** `PATCH /api/v1/companies/:companyId/members/transfer/:memberId`
- **Implemented:** `POST /api/v1/companies/:companyId/members/:memberId/transfer-ownership`
- **Controller:** `MemberController.transferOwnership`
- **Impact:** URL structure and HTTP method both changed.

---

### D) Resume Upload request contract changed

- **Documented:** `POST /api/v1/candidate/resumes` with JSON body (`file_url`, `title`, `is_primary`)
- **Implemented:** `POST /api/v1/candidate/resumes` as **multipart/form-data** with uploaded file
- **Controller:** `ResumeController.create` (`FileInterceptor('file')`)

#### Implemented request contract

- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` (required, binary)
  - `title` (optional, string)
  - `is_primary` (optional, string; `'true'` means primary)

#### Example

```http
POST /api/v1/candidate/resumes
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<binary_pdf>
title=Backend Resume 2026
is_primary=true
```

- **Impact:** JSON-only clients are incompatible unless updated to multipart upload.

---

## 3) New Endpoints (Present in Code, Missing in Docs)

### 1) Download candidate resume (signed URL)

- **Method/Path:** `GET /api/v1/candidate/resumes/:resumeId/download`
- **Auth:** `JwtAuthGuard`
- **Controller:** `ResumeController.download`
- **Purpose:** Returns a short-lived signed URL for secure resume download.

#### Response shape

```json
{
  "download_url": "https://...signed-url...",
  "filename": "resume.pdf",
  "mime_type": "application/pdf",
  "expires_in": 900
}
```

---

### 2) Company-side application resume fetch (signed URL)

- **Method/Path:** `GET /api/v1/companies/:companyId/applications/:applicationId/resume`
- **Auth/Guards:** `JwtAuthGuard` + `CompanyMembershipGuard`
- **Controller:** `CompanyApplicationController.getResume`
- **Purpose:** Lets company members access resume attached to a specific application.

#### Response shape

```json
{
  "download_url": "https://...signed-url...",
  "filename": "resume.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 123456,
  "expires_in": 900
}
```

---

## 4) Corrected Endpoint Inventory (Current Implementation)

> Total implemented endpoints: **37**

### Auth
1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/login`

### Company
3. `POST /api/v1/companies`
4. `GET /api/v1/companies/:companyId`
5. `PATCH /api/v1/companies/:companyId`

### Members
6. `POST /api/v1/companies/:companyId/members`
7. `GET /api/v1/companies/:companyId/members`
8. `PATCH /api/v1/companies/:companyId/members/:memberId/role`
9. `DELETE /api/v1/companies/:companyId/members/:memberId`
10. `POST /api/v1/companies/:companyId/members/:memberId/transfer-ownership`

### Question Banks
11. `POST /api/v1/companies/:companyId/question-banks`
12. `GET /api/v1/companies/:companyId/question-banks`
13. `GET /api/v1/companies/:companyId/question-banks/:qbId`
14. `PATCH /api/v1/companies/:companyId/question-banks/:qbId`

### Jobs
15. `POST /api/v1/companies/:companyId/jobs`
16. `GET /api/v1/companies/:companyId/jobs`
17. `GET /api/v1/companies/:companyId/jobs/:jobId`
18. `PATCH /api/v1/companies/:companyId/jobs/:jobId`
19. `PATCH /api/v1/companies/:companyId/jobs/:jobId/status`
20. `DELETE /api/v1/companies/:companyId/jobs/:jobId`
21. `GET /api/v1/jobs`

### Candidate Profile
22. `POST /api/v1/candidate/profile`
23. `GET /api/v1/candidate/profile`
24. `PATCH /api/v1/candidate/profile`

### Candidate Resumes
25. `POST /api/v1/candidate/resumes`
26. `GET /api/v1/candidate/resumes`
27. `GET /api/v1/candidate/resumes/:resumeId/download`
28. `PATCH /api/v1/candidate/resumes/:resumeId/primary`
29. `DELETE /api/v1/candidate/resumes/:resumeId`

### Candidate Applications
30. `POST /api/v1/candidate/applications`
31. `GET /api/v1/candidate/applications`
32. `PATCH /api/v1/candidate/applications/:applicationId/withdraw`

### Company Applications
33. `GET /api/v1/companies/:companyId/applications`
34. `PATCH /api/v1/companies/:companyId/applications/:applicationId/status`
35. `POST /api/v1/companies/:companyId/applications/:applicationId/comments`
36. `GET /api/v1/companies/:companyId/applications/:applicationId/resume`
37. `GET /api/v1/companies/:companyId/applications/:applicationId/comments`

---

## 5) Recommended Doc Updates to `API_DOCUMENTATION.md`

1. Replace member endpoint paths/methods with implemented ones.
2. Update resume upload section from JSON `file_url` to multipart file upload contract.
3. Add both new signed-download endpoints.
4. Update endpoint total from **35** to **37**.
