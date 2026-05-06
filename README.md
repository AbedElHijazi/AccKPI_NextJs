# AccKPI - Next.js

Workflow & Task Management System built with Next.js (Pages Router), MSSQL, and iron-session.

## Prerequisites

### Node.js & pnpm

This project uses **pnpm** as its package manager. We use pnpm because:
- **Faster** — installs packages in parallel and caches them globally
- **Disk efficient** — uses a content-addressable store, so shared dependencies aren't duplicated
- **Strict** — prevents phantom dependencies (packages you use but didn't declare)

**Install Node.js:**

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** (Long Term Support) version
3. Run the installer
4. Verify: `node --version` (should show v18+ or v20+)

**Install pnpm:**

```bash
npm install -g pnpm
```

Verify: `pnpm --version`

> **Why not npm?** npm creates flat `node_modules` and duplicates shared packages. pnpm uses symlinks and a global store, saving disk space and install time — especially noticeable in larger projects.

## Getting Started

```bash
cd accNextjs
pnpm install
pnpm dev
```

App runs at `http://localhost:3000`.

## Environment Variables

Create a `.env.local` file:

```env
DB_USER=sa
DB_PASSWORD=sa
DB_SERVER=10.10.2.123
DB_DATABASE=AccDBF
SESSION_SECRET=your-secret-key-min-32-characters-long!

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_TLS_REJECT_UNAUTHORIZED=false
SMTP_USER=no-reply@accsal.com
SMTP_PASS=
SMTP_FROM="ACC KPI <no-reply@accsal.com>"
EMAIL_FROM="ACC KPI <no-reply@accsal.com>"
HANDOFF_REPLY_TO="no-reply@gmail.com"
```

## Project Structure

```
accNextjs/
├── pages/
│   ├── api/                    # API routes
│   │   ├── auth/
│   │   │   ├── login.js        # POST - user login
│   │   │   ├── logout.js       # GET  - destroy session & redirect
│   │   │   ├── me.js           # GET  - current user info
│   │   │   └── session.js      # Session management
│   │   ├── tasks/
│   │   │   ├── index.js        # GET/POST - list & create tasks
│   │   │   ├── [id].js         # GET/PUT/DELETE - single task CRUD
│   │   │   ├── start.js        # POST - start a task (set TimeStarted)
│   │   │   ├── finish.js       # POST - finish a task (delay calc, auto-advance)
│   │   │   ├── save-updates.js # PUT  - update days/delay reason
│   │   │   ├── history.js      # GET  - task history per workflow
│   │   │   └── assign.js       # POST - assign task to user
│   │   ├── workflows/
│   │   │   ├── index.js        # GET/POST - list & create workflows
│   │   │   ├── add.js          # POST - create workflow (with validation)
│   │   │   ├── [id].js         # GET  - single workflow details
│   │   │   └── [id]/tasks.js   # GET  - tasks for a workflow
│   │   ├── workflow-steps/
│   │   │   ├── index.js        # GET  - list workflow steps
│   │   │   └── [id].js         # GET/PUT - get/update payment steps
│   │   ├── processes.js        # GET  - list processes
│   │   ├── processes/[id].js   # GET  - single process
│   │   ├── projects.js         # GET  - list projects
│   │   ├── packages.js         # GET  - list packages
│   │   ├── departments.js      # GET  - list departments
│   │   ├── suppliers.js        # GET  - list suppliers
│   │   ├── supplier-names.js   # GET  - supplier name lookup
│   │   ├── users/
│   │   │   ├── index.js        # GET  - list users
│   │   │   └── [id].js         # GET/PUT/DELETE - single user
│   │   ├── dashboard.js        # GET  - dashboard stats
│   │   └── workFlowDashData.js # GET  - workflow dashboard data
│   ├── login.js                # Login page
│   ├── homepage.js             # Homepage (after login)
│   ├── adminpage.js            # Admin dashboard
│   ├── workflowdashboard.js    # Workflow dashboard (main)
│   ├── userpage/[hdrId].js     # Task management page (per workflow)
│   ├── add-workflow.js         # Create new workflow form
│   ├── add-task.js             # Add/edit tasks for a process
│   ├── processes/index.js      # Process listing
│   ├── _app.js                 # App wrapper
│   └── _document.js            # HTML document
├── lib/
│   ├── db.js                   # MSSQL connection pool (singleton)
│   ├── session.js              # iron-session config
│   ├── auth.js                 # Auth middleware
│   ├── helpers.js              # DB helper functions (getWorkflowTasks, etc.)
│   ├── hooks.js                # React hooks (useAuth, useAdminAuth)
│   └── utils.js                # Utility functions
├── components/
│   └── Layout.js               # Shared layout component
└── public/
    ├── css/                    # FontAwesome, Bootstrap
    ├── styles/                 # Custom stylesheets
    ├── fonts/                  # Inter font family
    ├── images/                 # Static images
    └── js/                     # Legacy JS files
```

## Why Next.js (Migrated from Express/EJS)

### Architecture
| Area | Express (Before) | Next.js (After) |
|------|-----------------|-----------------|
| **Codebase** | 1 monolithic `index.js` (~5,244 lines) | 28 API routes + 12 pages, each in its own file |
| **Views** | EJS templates (server-rendered HTML strings) | React components (interactive, client-side state) |
| **Routing** | Manual `app.get()`/`app.post()` definitions | File-based — create a file, get a route automatically |
| **Frontend JS** | Separate vanilla JS files per page | JS lives inside the component — one file = UI + logic |

### Performance
| Area | Express | Next.js |
|------|---------|---------|
| **Page navigation** | Full page reload every click | Client-side navigation (instant, no reload) |
| **Data fetching** | Server renders entire HTML page | Fetches only JSON data, updates just what changed |
| **Bundling** | Loads all CSS/JS on every page | Automatic code splitting — loads only what each page needs |
| **Caching** | None | In-memory cache on lookup tables (5-min TTL) |

### Developer Experience
| Area | Express | Next.js |
|------|---------|---------|
| **Hot reload** | Restart server on every change | Instant hot reload — see changes without refresh |
| **Adding a page** | Create EJS + route + JS file (3 places) | Create 1 file in `pages/` |
| **Adding an API** | Add route in `index.js` (find the right spot in 5,000 lines) | Create 1 file in `pages/api/` |
| **Debugging** | Search through one massive file | Each route is its own file, easy to find |

### Security
| Area | Express | Next.js |
|------|---------|---------|
| **Sessions** | `express-session` (server memory) | `iron-session` (encrypted cookie — no server state) |
| **Scaling** | Session lost if server restarts | Session survives restarts (stored in cookie) |

## Key Features

### Authentication
- **iron-session** cookie-based sessions (1-week TTL)
- `useAuth()` hook for client-side auth checks
- Admin-only routes via `useAdminAuth()`

### Workflow Management
- Create workflows linked to a process, project, and package
- First task auto-selected by `StepOrder` from `tblProcessDepartment`

### Task Lifecycle
1. **Start** - Sets `TimeStarted` in `tblWorkflowDtl`, sets `PlannedDate` if missing
2. **Finish** - Sets `TimeFinished`, calculates delay, saves to history
3. **Auto-advance** - Next task in same department selected, planned date calculated
4. **Department advance** - When all tasks in a dept finish, next dept's first task is selected

### Multi-Payment Workflows
- Workflows can have multiple payment steps (`tblWorkflowSteps`)
- **Payment 1**: All departments including Procurement (DepId=8) and Contract (DepId=9)
- **Payment 2+**: Procurement & Contract are excluded (`MovePassOnce` departments)
  - Their `tblWorkflowDtl` records are **deleted** on advancement
  - Tasks reset: `TimeStarted`, `TimeFinished`, `Delay`, `PlannedDate` → NULL
  - First non-Proc/Contract task auto-selected
- **Set Start Date**: Available on active payment (2+), sets `StepStartDate` and selects first task
- **Task History**: Shows completed payment data with collapsible payment/department groups

### Task Page (`/userpage/[hdrId]`)
- Progress ring with completion percentage
- Status filter cards (Pending, In Progress, Completed, Overdue)
- Department timeline
- Department-grouped task tables with Start/Finish buttons (own dept only)
- Editable days required and delay reason modal
- CSV export
- Payment steps section (top of page)
- Task history with payment toggles (multi-payment only)

## Database

**MSSQL Server** with key tables:

| Table | Purpose |
|-------|---------|
| `tblTasks` | Task definitions (template + workflow copies) |
| `tblWorkflowHdr` | Workflow header (process, project, package, dates) |
| `tblWorkflowDtl` | Workflow task state (start/finish times, delay) |
| `tblWorkflowSteps` | Payment steps per workflow |
| `tblWorkflowTaskHistory` | Historical task data per payment step |
| `tblProcess` | Process definitions |
| `tblProcessDepartment` | Department order within a process (StepOrder) |
| `tblDepartments` | Department list (MovePassOnce flag for Proc/Contract) |
| `tblProject` | Project definitions |
| `tblPackages` | Package definitions |
| `tblUsers` | User accounts |

## Scripts

```bash
pnpm dev        # Development server (localhost:3000)
pnpm build      # Production build
pnpm start      # Start production server
```

## Performance

### Database Indexes
Run `migrations/add_performance_indexes.sql` on the database (one-time). Creates 11 indexes covering:
- `tblTasks` — by `WorkFlowHdrID`, `DepId`, `proccessID`, `linkTasks`
- `tblWorkflowDtl` — by `workFlowHdrId`, `TaskID`
- `tblWorkflowHdr` — by `processID`, `projectID`
- `tblWorkflowSteps` — by `workFlowID + isActive`
- `tblWorkflowTaskHistory` — by `workFlowID`
- `tblProcessDepartment` — by `ProcessID + DepartmentID`
- `tblUsers` — by `usrEmail`

### In-Memory Cache
Lookup tables (departments, projects, packages, supplier names) are cached for 5 minutes to reduce database load on repeated page loads.

### Combined Queries
Sequential queries in the task finish handler are combined into single JOIN queries to reduce round-trips to the database.
