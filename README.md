# KurzusRadar

**Live Demo & Production App:** [https://kurzusradar.site](https://kurzusradar.site)

Full-stack university course, exam, and assignment planner with deterministic conflict detection, an isolated client-side Live Demo, and PostgreSQL-backed user accounts.

The application UI is written in Hungarian for authentic university workflows, while the architecture, codebase, and documentation follow standard TypeScript engineering conventions.

## Key Capabilities

- **Deterministic Conflict Detection Engine** (`src/app/services/conflict-engine.ts`): Continuously evaluates all active (`planned` and `in_progress`) assessments against three rules:
  - **Direct Time Overlap (`critical`)**: Two timed assessments overlap on the same date (`t₁_start < t₂_end ∧ t₂_start < t₁_end`).
  - **Timetable Collision (`warning`)**: A timed exam or quiz overlaps with another course's weekly lecture, practice, or lab slot (exams scheduled during their own course's slot are intentionally excluded).
  - **Daily Workload Overload (`warning`)**: Flags days with at least 2 exams/quizzes, 3 or more open deadlines, or 40% or more combined grade weight.
- **Hybrid Workspace Architecture**:
  - **Live Demo Mode**: Runs entirely in browser `localStorage` with dynamically dated seed data and one-click reset, allowing visitors to test every feature without polluting the production database.
  - **Registered Accounts**: Start with a clean, empty workspace persisted in PostgreSQL via a cookie-authenticated REST API.
- **Pre-Save Conflict Preview**: The assessment form runs the conflict engine on draft input before submission so scheduling clashes are visible immediately.
- **Direct Conflict Resolution**: The Conflict Inspector lets users reschedule conflicting items inline or mark them submitted directly from each diagnostic card, paired with a day-by-day chronological timeline showing regular weekly classes alongside deadlines.
- **Course & Weekly Timetable Manager**: Full CRUD for courses, color coding, weekly slots, and automatic detection of overlapping class times.

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Angular (Standalone Components, Signals, Reactive Forms, Lazy-Loaded Routes), TypeScript, Custom CSS Design System (IBM Plex Sans & Mono) |
| **Backend API** | Node.js 22, Express, TypeScript, Prisma ORM, Zod Validation |
| **Database** | PostgreSQL 16 |
| **Auth & Security** | `bcryptjs`, `HttpOnly` + `SameSite=Lax` JWT session cookies, Helmet, Express Rate Limit, strict per-user ownership checks (IDOR protection) |
| **Infrastructure** | Docker Compose (multi-stage Alpine builds), Caddy 2 reverse proxy with automatic Let's Encrypt HTTPS |

## Repository Structure

```text
.
├── src/
│   └── app/
│       ├── data/              Dynamic demo seed generator
│       ├── guards/            Workspace & guest-only route guards
│       ├── layout/            Authenticated & demo workspace shell
│       ├── models/            Shared domain & auth TypeScript models
│       ├── pages/             Landing, Auth, Dashboard, Courses, Assessments, Conflicts
│       └── services/          Conflict engine, AuthService, hybrid AcademicStoreService
├── backend/
│   ├── prisma/                PostgreSQL schema
│   ├── src/
│   │   ├── config/            Zod-validated environment loader
│   │   ├── lib/               Prisma client, JWT cookie helpers, serializers
│   │   ├── middleware/        Auth guard & centralized error handler
│   │   └── routes/            Auth, Workspace, Courses/Slots, Assessments REST routes
│   └── Dockerfile
├── Caddyfile                  Reverse proxy, SPA routing, automatic HTTPS
├── Dockerfile.frontend        Angular production build + Caddy runtime
├── docker-compose.yml         PostgreSQL + API + Web stack
└── DEPLOY.md                  Ubuntu VPS & custom domain deployment guide
```

## API Overview

| Method & Endpoint | Auth | Description |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Container healthcheck endpoint |
| `POST /api/auth/register` | Public | Create user account and set session cookie |
| `POST /api/auth/login` | Public | Authenticate credentials and set session cookie |
| `POST /api/auth/logout` | Public | Clear session cookie |
| `GET /api/auth/me` | Required | Return active authenticated user profile |
| `GET /api/workspace` | Required | Fetch all courses, slots, and assessments for the user |
| `DELETE /api/workspace` | Required | Clear all courses and assessments for the user |
| `GET / POST /api/courses` | Required | List or create courses |
| `PATCH / DELETE /api/courses/:courseId` | Required | Update or delete a course (cascades slots & assessments) |
| `POST / DELETE /api/courses/:courseId/slots(/:slotId)` | Required | Add or remove weekly timetable slots |
| `GET / POST /api/assessments` | Required | List or create assessments |
| `PATCH / DELETE /api/assessments/:assessmentId` | Required | Update, reschedule, change status, or delete an assessment |

## Quickstart with Docker Compose

1. Clone the repository and create a local environment file:

```bash
cp .env.example .env
```

2. Build and start PostgreSQL, the Express API, and the Angular + Caddy container:

```bash
docker compose up -d --build
```

3. Open the application:

- Frontend & Live Demo: `http://localhost`
- API Healthcheck: `http://localhost/api/health`

4. Stop containers when finished:

```bash
docker compose down
```

## Local Development (Without Docker)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

### Frontend

```bash
npm install
npx ng serve --proxy-config proxy.conf.json
```

## Production Deployment

See [DEPLOY.md](./DEPLOY.md) for the complete Ubuntu VPS, firewall, DNS, automatic HTTPS (Caddy), and PostgreSQL backup workflow.
