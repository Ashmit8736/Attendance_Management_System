# Technical Note: Attendance Management Module

Stack: React 18 (Vite, React Router v6, Axios, plain CSS) · Node.js / Express · PostgreSQL · JWT + bcrypt.

---

## 1. Database Design

Five tables plus a `schema_migrations` bookkeeping table. The schema is built from numbered SQL files in `backend/src/database/migrations/` (see "Migrations" below).

```
users 1───* attendance 1───* correction_requests
  │ 1                              │ (user_id, reviewed_by → users)
  └───* audit_logs                 
attendance_rules (exactly one row, updated_by → users)
```

| Table | Purpose | Key decisions |
| :--- | :--- | :--- |
| `users` | Accounts and roles | `role` is a `CHECK`ed enum (`EMPLOYEE`/`HR`/`ADMIN`). Email is unique **case-insensitively** (`UNIQUE (LOWER(email))`). Accounts are deactivated (`is_active`), never deleted. Only the bcrypt hash is stored. |
| `attendance_rules` | Office start, grace period, late cutoff, half/full-day hours | Policy lives in the DB, so Admin changes it without a deploy. A unique index on `((TRUE))` allows **only one row**. `CHECK`s keep it consistent: grace 0-120, `half < full ≤ 24`, cutoff ≥ start + grace. |
| `attendance` | One row per user per day | `UNIQUE (user_id, date)` makes a double clock-in impossible even under concurrent requests. `CHECK (clock_out > clock_in)` and `total_hours >= 0`. `status` is a `CHECK`ed enum. `is_corrected` marks rows changed by an approved correction. |
| `correction_requests` | Employee request to fix a day | Stores `work_date`, requested in/out, reason, `status`, `reviewed_by`, `review_note`, `reviewed_at`. A **partial unique index** `(user_id, work_date) WHERE status = 'PENDING'` allows only one open request per user per day, including absent days that have no attendance row. `CHECK`s: `requested_clock_out > requested_clock_in`, and a processed request must have `reviewed_at`. |
| `audit_logs` | Who did what | `action`, `entity_type`, `entity_id`, `details JSONB`, `ip_address`, `created_at`. **Append-only**: a trigger rejects every UPDATE and DELETE (the only allowed change is the FK action that nulls `user_id`). |

**History is protected:** the foreign keys from `attendance` and `correction_requests` to `users` (and from corrections to attendance) are `ON DELETE RESTRICT`, so a user or record that has history cannot be removed. `audit_logs.user_id` uses `ON DELETE SET NULL`, so logs always survive.

**Indexes** match real queries: `(user_id, date)` via the unique constraint, `attendance(date DESC)` for range reports, `audit_logs(created_at DESC)` for the newest-first audit page, `(user_id, action)` for filters, `correction_requests(status)`, `(user_id, created_at DESC)` and `(attendance_id)`.

**Migrations:** `001_initial_schema` → `002_data_integrity` (constraints, FK actions, audit trigger) → `003_correction_work_date` (new column, backfill, partial unique index) → `004_query_indexes`. `npm run migrate` applies pending files (each in its own transaction, recorded in `schema_migrations`). The same runner executes on server start and before seeding, so a fresh database and an upgraded one always end up identical. Applied files are never edited; changes go into the next numbered file.

**Main DB decision (for walkthrough):** business rules are enforced **in the database as well as in code**. `UNIQUE (user_id, date)` and the partial unique index on pending corrections hold even if two requests race past the application check, and the audit trigger means even buggy code or manual SQL cannot rewrite history.

---

## 2. Frontend / Backend Structure

### Backend (`backend/src`), layered
```
routes/       URL + middleware wiring only (auth, role check)
controllers/  parse request, call service, shape response
services/     business rules + SQL (attendance, correction, user, rule, auth, audit)
middleware/   auth (JWT), role (authorizeRoles), validate (Zod), central error handler
validators/   Zod schemas for every route's params / query / body
errors/       AppError with HTTP status (400/401/403/404/409)
config/       env + pg pool
utils/        jwt, password hashing, apiResponse, office-timezone + status-rule helpers
database/     migrations/*.sql, migrate.js (runner), seedRunner.js
tests/        node:test + supertest (unit + API tests)
```

**Request pipeline:** `route → authenticateToken → authorizeRoles → validate(schema) → controller → service → DB`. Validation runs after authorization, so unauthorised callers learn nothing about the payload rules. Services throw `AppError` with the right status and the central error handler formats every error as `{ success: false, message, errors? }`. Unexpected errors return a generic 500 and are only logged server-side.

### API summary (base `/api`)
| Method & path | Roles |
| :--- | :--- |
| `POST /auth/login`, `GET /auth/me` | public / any logged-in |
| `POST /attendance/clock-in`, `/clock-out`, `GET /today`, `/history`, `/metrics` | any logged-in |
| `POST /corrections`, `GET /corrections` | any logged-in (Employee sees own only) |
| `PATCH /corrections/:id/review` | HR, Admin |
| `GET /users` | HR, Admin |
| `POST /users`, `PUT /users/:id`, `PATCH /users/:id/toggle-status` | Admin |
| `GET /rules` | any logged-in |
| `PUT /rules` | Admin |
| `GET /audit-logs` | Admin |

### Frontend (`frontend/src`)
```
pages/        Dashboard, AttendanceHistory, Corrections, admin/{Users, Rules, AuditLogs}, auth/Login
components/   layout (Navbar, Sidebar, Layout), common (Modal, Pagination, TableState, Badge, StatCard, ErrorBoundary)
context/      AuthContext (token, user), ToastContext (notifications), ConfirmContext (confirm dialogs)
hooks/        usePageTitle
routes/       AppRoutes, ProtectedRoute (role-aware)
services/     Axios wrappers per API area (api.js attaches the JWT)
styles/       one CSS file per area + helpers.css, feedback.css (toasts, empty states, a11y), responsive.css
```
Styling is plain CSS, with no inline styles and no CSS framework.

**UX and accessibility decisions**
* **Feedback:** results of actions show as toasts (`useToast`; errors use `role="alert"`, identical messages are de-duplicated). Form errors stay inside the dialog next to the fields. Every list has distinct loading, empty and failed states, and a failed load offers "Try again" instead of a blank table.
* **Confirmations:** destructive actions use an accessible confirm dialog (`useConfirm`, focus starts on Cancel) rather than `window.confirm`. The signed-in admin does not even see a "deactivate" button for their own account.
* **Dialogs:** `role="dialog"`, `aria-modal`, labelled by the title, focus trap, Escape and backdrop to close, and focus returns to the control that opened them.
* **Responsive:** below 1024px the sidebar becomes a drawer (hamburger with `aria-expanded`; closes on navigation and Escape; hidden from keyboard focus while closed). Tables scroll inside their card, forms collapse to one column, and touch targets grow on touch devices.
* **Forms:** every input has an associated `<label>`, plus `autocomplete`, length limits that mirror the API schemas, and a live "what these rules mean" preview with the same consistency checks as the server on the Rules page.
* **Pagination** is shared by History, Corrections, Users and Audit pages, so no list silently stops at the first page.
* **Other:** skip-to-content link, visible keyboard focus, per-page document titles, `prefers-reduced-motion` support, colour tokens adjusted to meet WCAG AA contrast, and an error boundary so a rendering bug shows a recovery screen instead of a blank page.

**Main frontend flow (for walkthrough):** Dashboard → "Clock In" → `attendanceService.clockIn()` → `POST /attendance/clock-in` → the page reloads today's status, and the live timer and status badge update.

---

## 3. Role-Based Access Approach

Authorization is enforced **on the backend**; the frontend only hides what a role cannot use.

1. `authenticateToken` verifies the JWT, then **re-reads the user from the DB** on every request. A deactivated user or a role change takes effect immediately, even with an old token.
2. `authorizeRoles(...roles)` guards routes and returns `403` when the role is not allowed.
3. **Data scoping in controllers:** for `EMPLOYEE`, the controller overrides the user id with `req.user.id` for history, metrics and corrections. A client-supplied `userId` is ignored, so an employee cannot read another person's data.
4. Frontend: `ProtectedRoute allowedRoles=[...]` and a role-filtered sidebar for UX only.

| Capability | Employee | HR | Admin |
| :--- | :---: | :---: | :---: |
| Clock in/out, own history, request correction | ✅ | ✅ | ✅ |
| View organisation attendance / all corrections | ❌ | ✅ | ✅ |
| Approve / reject corrections | ❌ | ✅ | ✅ |
| View user directory | ❌ | ✅ | ✅ |
| Create / edit / (de)activate users and roles | ❌ | ❌ | ✅ |
| Edit attendance rules | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |

**Main permission decision (for walkthrough):** rule changes and user/role management are Admin-only, because they change policy and access for everyone. Correction review is open to HR as well, since it is day-to-day HR work.

---

## 4. Important Validations

**Request validation (Zod, every route)**
* Types are coerced and unknown fields are stripped; empty filter strings are treated as "not provided".
* Passwords: 8-72 chars with at least one letter and one number. Emails are trimmed and lower-cased.
* Dates must be `YYYY-MM-DD`; history range must have start ≤ end; list `limit` is capped at 100.
* Correction times cannot be in the future; reason is 5-500 characters. Zone-less date-times from the browser are read as office-timezone wall-clock time, and the requested clock-in must fall on the day being corrected.
* A correction can only target the caller's **own** attendance record (another user's id returns 404).
* Errors return a field-level list: `errors: [{ field, message }]`, with the first message in `message`.

**Attendance**
* Only one clock-in per user per day: application check plus the DB unique constraint.
* Clock-out requires an existing clock-in for today, and is rejected if already clocked out.
* Status is derived by the server from the rules table (grace period and cutoff are in the office timezone): clock-in up to `office_start_time + grace_period_minutes` → `PRESENT`; up to `late_threshold_time` → `LATE`; after the cutoff → `HALF_DAY`. Clock-out with worked hours below `half_day_min_hours` is also `HALF_DAY`. The client cannot choose a status.
* Rule updates are validated: valid times, grace 0-120 min, cutoff not earlier than start + grace, half-day hours < full-day hours.
* All times are taken from the server clock, never from the client.

**Corrections**
* Requested in, out and reason are all required.
* Clock-out must be strictly after clock-in.
* Only one `PENDING` request per user per day (checked in code and enforced by a unique index).
* A reviewer cannot review their own request, and the request row is locked (`SELECT ... FOR UPDATE`) inside the review transaction so two reviewers cannot process it twice.
* Review status must be `APPROVED` or `REJECTED`, and an already-processed request cannot be reviewed again.
* On approval, the request update and the attendance update run in **one DB transaction** (`BEGIN`/`COMMIT`), so they cannot get out of sync. Hours and status are recomputed from the rules.

**HTTP status codes:** 400 validation, 401 bad/missing credentials or token, 403 wrong role or inactive account, 404 not found, 409 duplicate / already processed, 429 rate limited, 500 unexpected.

**Users / auth**
* Name, email, password and role are required. Email must be unique.
* Login rejects wrong credentials with a generic message (no user enumeration) and rejects inactive accounts.
* An Admin cannot deactivate their own account.
* Passwords are hashed with bcrypt and never returned by the API.
* Security middleware: `helmet` headers, JSON body limit (100 kb), a general API rate limit (300 req/min/IP) and a stricter login limit (10 failed attempts per 15 min per IP; successful logins don't count).
* The one-click demo credentials endpoint is on in development and off by default in production (`ENABLE_DEMO_LOGIN`).

**Main validation decision (for walkthrough):** status and hours are computed on the server from the stored rules, so the data can't be spoofed from the browser and rule changes apply consistently.

---

## 5. Assumptions

1. One shift per employee per calendar day.
2. A "day" is the calendar date in the office timezone (`OFFICE_TIMEZONE`, default `Asia/Kolkata`), and clock times come from the server.
3. All three time rules are used: grace extends the on-time window; the late cutoff is the point after which a clock-in counts as a half day.
4. `ABSENT` is a valid status value, but absent days are not auto-generated; a missing row means no attendance was recorded.
5. Approved corrections are re-classified with the same rules (late / half-day) using the corrected times.
6. HR and Admin can review any correction except their own.
7. Seed credentials come from `.env` and fall back to the documented defaults when `.env` is absent.
8. Audit-log immutability is by convention: the app only inserts and exposes no update/delete path. It is not cryptographically tamper-proof.

---

## 6. Improvements Possible with More Time

* **Per-user / per-shift timezone** instead of one office timezone.
* **Stronger audit trail:** a hash chain, or a separate DB role without ownership of `audit_logs`. The trigger stops application code, but the table owner could still drop it.
* **Auth hardening:** refresh tokens / token revocation, per-account (not just per-IP) lockout, password-change flow.
* **Write-path integration tests** on a disposable test database (the current API tests are read-only against the seeded DB).
* **Shared validation schemas** between frontend and backend to avoid duplicated rules. Today the Rules page repeats the consistency check, and forms mirror the API limits by hand.
* **Frontend tests** (component tests and an end-to-end flow such as Playwright). The UI was verified with scripted headless-browser checks that are not part of the repository.
* **Dark mode and i18n**, plus a full screen-reader pass beyond the automated checks.
* **Down-migrations / a mature migration tool** (e.g. node-pg-migrate) for rollbacks and team workflows; the current runner is forward-only.
* **Absent-day job:** scheduled job to mark `ABSENT`, with holidays and weekends.
* **Reports:** CSV/Excel export and monthly summaries for payroll.
* **Notifications:** email/in-app alerts on correction approval or rejection.
* **Leave management** and shift schedules; biometric/device integration.
