# AttendTrack - Attendance Management Module

An enterprise attendance management module built with **React**, **Node.js/Express**, and **PostgreSQL**.

---

## 👥 Sample Credentials (Pre-seeded)

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| 👑 **System Admin** | `admin@company.com` | `Admin@123` | Full Access: Users, Rules Settings, Audit Logs, Corrections |
| 💼 **HR Manager** | `hr@company.com` | `Hr@123` | Management Access: Review & Approve Corrections, Org Directory |
| 👤 **Employee** | `employee@company.com` | `Emp@123` | Standard Access: Clock-in/out, View History, Submit Corrections |

> *Tip: The Login page includes **1-Click Demo Buttons** to instantly sign in as any of the above roles.*

---

## 🚀 Quick Setup Guide

### 1. Prerequisites
* **Node.js**: `v18+` or `v20+` installed
* **PostgreSQL**: Running on `localhost:5432` with a database named `attendance_db` (or configure `.env`)

### 2. Clone and Install Dependencies
```bash
# In the root project directory:
npm run install:all
```

### 3. Database Configuration
1. Open `backend/.env` (or copy from `backend/.env.example`):
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=attendance_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=super_secret_jwt_key_attendance_system_2026
```

2. Create / upgrade the tables (also runs automatically when the backend starts), then seed sample users, company rules, and dummy attendance history:
```bash
npm run migrate   # apply pending SQL migrations
npm run seed      # sample data (clears existing data!)
```

### 4. Running the Application
Start the backend and frontend servers:

```bash
# Terminal 1 - Backend (Runs on http://localhost:5000)
npm run backend:dev

# Terminal 2 - Frontend (Runs on http://localhost:5173)
npm run frontend
```

---

## ☁️ Deployment (Vercel + Render + Neon)

Frontend on **Vercel**, API on **Render**, PostgreSQL on **Neon** (all have free tiers). Locally nothing changes: `DATABASE_URL` is optional and the `DB_*` variables still work.

**1. Database (Neon).** Create a project and copy the connection string (`postgresql://...?sslmode=require`).

**2. Backend (Render).** *New → Blueprint* and pick this repo (it reads [render.yaml](render.yaml)), or create a Web Service by hand with root directory `backend`, build `npm install`, start `npm start`, health check `/health`. Environment variables:

| Variable | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Neon connection string |
| `JWT_SECRET` | long random string (the server refuses to start in production without it) |
| `CORS_ORIGIN` | your Vercel URL |
| `OFFICE_TIMEZONE` | `Asia/Kolkata` |
| `ENABLE_DEMO_LOGIN` | `true` to show the one-click demo buttons (off by default in production) |

Tables are created automatically on first start (migrations).

**3. Seed the sample users (once).** Run from your computer against the hosted database:
```bash
# macOS / Linux / Git Bash
DATABASE_URL="<neon-url>" SEED_CONFIRM=yes npm run seed --prefix backend
# PowerShell
$env:DATABASE_URL="<neon-url>"; $env:SEED_CONFIRM="yes"; npm run seed --prefix backend
```
Seeding deletes existing data, so it refuses to touch a non-local database unless `SEED_CONFIRM=yes` is set. If you changed the seed passwords locally (`ADMIN_PASSWORD`, ...), set the same values on Render, because the demo buttons show the server's values.

**4. Frontend (Vercel).** Import the repo with root directory `frontend`. Edit [frontend/vercel.json](frontend/vercel.json) and replace `YOUR-RENDER-URL` with your Render service URL, so `/api/*` is proxied to the backend. Do **not** set `VITE_API_URL`; the browser then talks to a single origin. The second rewrite lets page refreshes on routes like `/attendance` work.

**5. Check.** Open `https://<render-url>/health`, then sign in on the Vercel URL.

> Render's free plan sleeps after 15 minutes without traffic, so the first request afterwards takes ~30-50 s. Open `/health` once before demoing.

**Live demo:** _add your Vercel URL here_ &nbsp;|&nbsp; **API:** _add your Render URL here_

---

## 🧪 Running Tests
```bash
npm run test --prefix backend        # unit + database + config + API tests (80)
```
The database and API tests change nothing (DB tests roll back; API tests are read-only). They use the seeded users, so run `npm run seed` first and keep PostgreSQL running.

---

## 🛠 Features Implemented
- [x] **Secure Authentication**: JWT-based stateless auth with password encryption (`bcrypt`).
- [x] **Role-Based Access Control (RBAC)**: Strict backend middleware authorization for `EMPLOYEE`, `HR`, and `ADMIN`.
- [x] **Attendance Station**: Live clock-in and clock-out with real-time active shift duration timer.
- [x] **Today's Status & History**: Filterable history table by date range and status.
- [x] **Correction Request Workflow**: Employees submit correction requests; HR/Admins review and approve/reject with remarks.
- [x] **User Management**: Admin panel to add employees, edit roles, and toggle active/inactive account status.
- [x] **Customizable Attendance Policy Rules**: Admin settings to configure office start times, grace period, late threshold, and half-day hours.
- [x] **System Audit Logs** (Admin only): Records clock operations, rule changes, user changes and review decisions with timestamps and IP addresses. The app only ever inserts into this table.
- [x] **Responsive, Accessible UI**: mobile navigation drawer, toasts, confirm dialogs, keyboard-friendly dialogs and forms, loading/empty/error states, and pagination on every list.
- [x] **Request Validation & Safe Errors**: Zod schemas on every route, correct HTTP status codes, `helmet`, and login rate limiting.
- [x] **Timezone-aware Attendance Rules**: grace period, late cutoff and half-day rules evaluated in `OFFICE_TIMEZONE` (default `Asia/Kolkata`).

---

## 📚 Deliverables Checklist
- [x] Git Repository structure
- [x] README with setup steps
- [x] Sample credentials for all roles
- [x] Database migrations & seed scripts (`backend/src/database/migrations/*.sql`, `migrate.js` & `seedRunner.js`)
- [x] Short technical note (`docs/technical-note.md`)
