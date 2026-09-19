# Leadyfy OS — Internal Agency Management & Operations SaaS

> Production-grade internal operating system engineered specifically for **User-Generated Content (UGC) & Digital Marketing Agencies**. Replaces fragmented spreadsheets, WhatsApp threads, and disjointed tools with a unified, end-to-end operational platform.

---

## Table of Contents
1. [Product & Architecture Overview](#product--architecture-overview)
2. [Key Requirements & Solved Issues](#key-requirements--solved-issues)
3. [User Roles & RBAC Matrix](#user-roles--rbac-matrix)
4. [Tech Stack](#tech-stack)
5. [Getting Started & Local Setup](#getting-started--local-setup)
6. [Pre-Seeded Test Accounts](#pre-seeded-test-accounts)
7. [Automated Test Suite](#automated-test-suite)
8. [Database Schema (20 Entities)](#database-schema-20-entities)
9. [REST API Documentation](#rest-api-documentation)
10. [Production Deployment & Backup Policy](#production-deployment--backup-policy)

---

## 1. Product & Architecture Overview

Leadyfy OS orchestrates the entire operational lifecycle of a UGC agency:
```
Lead / Client ──> Onboarding ──> Package / Order ──> Scripting ──> Creator Match ──> Shoot
  ──> Video Editing ──> Client Review ──> Revisions ──> Final Delivery ──> Creator Payouts & Net Profit
```

### Core Architecture Highlights
- **Single Page Application (SPA)**: Pure Vanilla JavaScript & CSS design tokens. No heavyweight frontend dependencies; instant load speeds and zero build-step overhead.
- **Relational ACID Database**: SQLite engine running via WebAssembly (`sql.js`) with foreign key constraints, ACID transaction boundaries, and automatic disk persistence to `data/leadyfy.sqlite`.
- **JWT & Role-Based Access Control**: HTTP-only cookies and Bearer token support with multi-tenant client isolation middleware.

---

## 2. Key Requirements & Solved Issues

### A. Critical Client Creation Bug Resolution (`company` vs `company_name`)
- **Root Cause**: Previous revisions suffered from field name mismatches across client onboarding forms (`company`), API validation, and the relational database schema (`company_name`).
- **Resolution**:
  - Unified relational schema: `company_name TEXT NOT NULL`.
  - Resilient ingestion in `clientService.js`: `const company_name = (data.company_name || data.company || '').trim()`.
  - Verified end-to-end via automated test `tests/test_client_company_bug.js`.

### B. Live Production Quotas
- Every client package tracks video volume dynamically: `total_videos = completed + remaining_quota`.
- Live visual progress bars update automatically on video delivery.

### C. Creator Double-Booking Prevention
- Scheduling algorithm validates creator availability and checks for conflicting shoot times before booking. Overlapping shoots are rejected with `400 Bad Request`.

### D. Strict Video Production State Machine
- 9 strictly enforced sequential states:
  `RAW_FOOTAGE_RECEIVED` → `VIDEO_EDITING` → `INTERNAL_QA` → `CLIENT_REVIEW` → `CLIENT_REVISION_REQUESTED` / `FINAL_APPROVED` → `DELIVERED`.
- Invalid jumps (e.g. attempting to jump straight from `RAW_FOOTAGE_RECEIVED` to `DELIVERED`) are rejected at the service layer.

### E. Idempotent Final Delivery
- Client approval triggers final delivery, linking Google Drive / Cloud storage URLs and decrementing remaining quota (-1).
- Subsequent calls to `/deliver` for an already delivered video return gracefully without double-decrementing quotas.

### F. Financial Ledger & Duplicate Payout Protection
- Real-time ledger calculating: `Net Profit = Total Inbound Revenue - Operating Expenses - Creator Payouts`.
- Unique constraints and validation prevent paying a creator twice for the same shoot.

### G. Total Client Isolation
- Client 1 (`Glow Beauty`) and Client 2 (`FitFuel Labs`) are segregated into isolated portals.
- Clients are strictly barred from viewing internal creator rate cards, agency costs, team tasks, or audit logs.

---

## 3. User Roles & RBAC Matrix

| Feature / Module | OWNER | ADMIN | SALES | SCRIPT_WRITER | SHOOT_MGR | EDITOR | CLIENT |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Executive Dashboard & KPIs** | Full | Full | Dept | Dept | Dept | Dept | Isolated |
| **Client Directory & 360 Profiles** | Full | Full | Read/Write | Read | Read | Read | ❌ |
| **Orders & Live Quotas** | Full | Full | Full | Read | Read | Read | Own Orders |
| **Script Workshop & Hooks** | Full | Full | Read | Full | Read | Read | Review/Approve |
| **Creator Roster & Rates** | Full | Full | Masked | Masked | Read | Masked | ❌ |
| **Production Shoots & Checklists** | Full | Full | Read | Read | Full | Read | ❌ |
| **Video Review Room** | Full | Full | Read | Read | Read | Full | Review/Approve |
| **Financial Ledger & Invoices** | Full | Full | Invoices | ❌ | ❌ | ❌ | Invoices Only |
| **Creator Payouts & Net Profit** | Full | Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Internal Task Board** | Full | Full | Team | Team | Team | Team | ❌ |
| **Support Desk** | Full | Full | Full | Team | Team | Team | Own Tickets |
| **System Audit Logs** | Full | Full | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Tech Stack

- **Backend**: Node.js v20+ / v24, Express.js, CORS, Cookie-Parser, Bcrypt.js, JSONWebToken.
- **Database Engine**: WebAssembly SQLite (`sql.js`) with disk persistence (`data/leadyfy.sqlite`).
- **Frontend Architecture**: Vanilla JavaScript (ES6+), Modular View Controller pattern, CSS Design Tokens.
- **Design System**: High-density Minimalist Dark UI (`#111111` Charcoal, `#F59E0B` Amber, `#FFFFFF` White, Plus Jakarta Sans, JetBrains Mono).

---

## 5. Getting Started & Local Setup

### Prerequisites
- Node.js (v18, v20, or v24)
- npm

### Installation & Launch
```bash
# 1. Clone or navigate to the repository
cd leadyfy-os

# 2. Install dependencies
npm install

# 3. Seed initial database (creates all 20 tables and seed users)
node src/database/seed.js

# 4. Start the application server
npm start
# or: node src/server.js
```
Open **`http://localhost:3000`** in your browser.

---

## 6. Pre-Seeded Test Accounts

The system comes pre-seeded with test accounts across all roles. All accounts use password: `password123`.

| Role | Name | Email | Password | Primary Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | Vikram Malhotra | `owner@leadyfy.com` | `password123` | Complete Super Admin access, Financials, Audit Logs |
| **Admin** | Neha Kapoor | `admin@leadyfy.com` | `password123` | Operations management, team assignments, shoots |
| **Script Writer** | Aryan Saxena | `writer@leadyfy.com` | `password123` | Script drafts, hooks, client revision workflows |
| **Shoot Manager** | Sameer Joshi | `shootmgr@leadyfy.com` | `password123` | Shoot calendars, 5-point checklists, logistics |
| **Video Editor** | Karan Verma | `editor@leadyfy.com` | `password123` | Video state transitions, cut uploads, feedback |
| **Sales Rep** | Anjali Nair | `sales@leadyfy.com` | `password123` | Client onboarding, new orders & package quotas |
| **Client 1** | Glow Beauty | `client1@glowbeauty.com` | `password123` | Isolated portal: Glow Beauty orders, scripts, video review |
| **Client 2** | FitFuel Labs | `client2@fitfuel.com` | `password123` | Isolated portal: FitFuel data only |

> **Pro-Tip**: Use the **1-Click Role Switcher** in the top-right header of the web application to switch roles instantly without re-typing passwords.

---

## 7. Automated Test Suite

The test suite covers every mission-critical business rule and edge case:

```bash
node tests/run_all_tests.js
```

### Test Suite Summary (8/8 Passed - 100%)
1. `tests/test_auth_rbac.js`: Validates password hashing, JWT issue, role boundaries, and token verification.
2. `tests/test_client_company_bug.js`: Verifies the fix for the `company` vs `company_name` mismatch across form, API, and database.
3. `tests/test_creator_double_booking.js`: Tests conflicting shoot bookings and confirms overlapping shoots are rejected.
4. `tests/test_video_state_machine.js`: Verifies linear state progression and rejection of invalid state transitions.
5. `tests/test_delivery_idempotency.js`: Verifies idempotent video delivery and quota deduction safety.
6. `tests/test_financials.js`: Tests invoices, operational expenses, duplicate creator payout protection, and net profit math.
7. `tests/test_client_isolation.js`: Confirms Client 1 cannot read Client 2 data, creator rate cards, or internal ledgers.
8. `tests/test_e2e_full_lifecycle.js`: Complete end-to-end lifecycle from client creation to final delivery and payout.

---

## 8. Database Schema (20 Entities)

All tables defined in `src/database/schema.sql`:
1. `users`: Core authentication identity table (email, password_hash, role, sub_role, phone).
2. `employees`: Staff metadata (department, salary, skills, joining date).
3. `clients`: Brand & company records (`company_name`, industry, brand assets, GST ID).
4. `orders`: Commercial packages and live quota allowances.
5. `scripts`: UGC concepts, hooks, body copy, and revision histories.
6. `creators`: Talent network profiles, niches, portfolio links, and bank/UPI details.
7. `creator_availability`: Workload tracking dates to prevent double-booking.
8. `shoots`: Production shoot logistics, locations, and attendance.
9. `shoot_checklists`: 5-point pre-shoot verification checklist.
10. `videos`: Core video pipeline state machine entities.
11. `video_feedback`: Timestamped client comments and revision requests.
12. `invoices`: Commercial billing invoices and GST line items.
13. `payments`: Client inbound payment records and payment modes.
14. `expenses`: Internal agency operating expenditures and categories.
15. `creator_payouts`: Talent disbursement records with duplicate payout prevention.
16. `tasks`: Internal team task board items and urgency levels.
17. `support_tickets`: Client inquiry and technical support threads.
18. `support_replies`: Discussion messages on support tickets.
19. `notifications`: In-app alert queue with unread status tracking.
20. `audit_logs`: Immutable security ledger recording all system actions.

---

## 9. REST API Documentation

Base URL: `http://localhost:3000/api`

### Authentication (`/api/auth`)
- `POST /login`: Authenticates user, returns JWT and sets secure cookie.
- `POST /register`: Registers new client/user and auto-links company profile.
- `POST /logout`: Clears session cookie.
- `GET /me`: Returns profile and permissions of authenticated user.

### Clients (`/api/clients`)
- `GET /`: List all client accounts (filtered for internal team).
- `POST /`: Create client with unified `company_name`.
- `GET /:id`: Full 360° client profile (orders, scripts, shoots, videos, invoices).

### Orders (`/api/orders`)
- `GET /`: List orders with live quota calculation (`completed_videos`, `remaining_quota`).
- `POST /`: Book new package order for a client.
- `GET /:id`: Detailed order milestones and payment status.

### Scripts (`/api/scripts`)
- `GET /`: Script workshop list (filtered by role and client).
- `POST /`: Draft new UGC script.
- `POST /:id/approve`: Client / internal approval.
- `POST /:id/revision`: Request script revision with notes.

### Shoots (`/api/shoots`)
- `GET /`: Shoot calendar schedule.
- `POST /`: Schedule shoot with double-booking check.
- `PUT /:id/checklist`: Update 5-point pre-shoot checklist.

### Videos (`/api/videos`)
- `GET /`: Video pipeline list.
- `POST /:id/transition`: Transition video state according to strict state machine.
- `POST /:id/feedback`: Attach timestamped review note.
- `POST /:id/deliver`: Idempotent final delivery and quota update.

### Financials (`/api/finance`)
- `GET /summary`: Real-time executive net profit, revenue, and expense metrics.
- `GET /invoices`: Invoices and payment statuses.
- `POST /payments`: Record inbound client payment.
- `POST /expenses`: Record operating expense.
- `POST /payouts`: Record creator payout with duplicate protection.

---

## 10. Production Deployment & Backup Policy

### Environment Configuration (`.env`)
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=super_secure_production_jwt_secret_key_leadyfy_2026
JWT_EXPIRES_IN=7d
DB_PATH=./data/leadyfy.sqlite
```

### Process Management
Run with PM2 in production:
```bash
npm install -g pm2
pm2 start src/server.js --name "leadyfy-os"
pm2 save
pm2 startup
```

### Database Backup Policy
The SQLite database file is stored at `data/leadyfy.sqlite`.
- **Scheduled Automated Backup**: Configure a daily cron job to create timestamped snapshot copies:
  ```bash
  sqlite3 data/leadyfy.sqlite ".backup 'backups/leadyfy_backup_$(date +%Y%m%d_%H%M%S).sqlite'"
  ```
- **Integrity Check**:
  ```bash
  sqlite3 data/leadyfy.sqlite "PRAGMA integrity_check;"
  ```
