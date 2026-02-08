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

## Key Features

### Authentication
- **iron-session** cookie-based sessions (1-week TTL)
- `useAuth()` hook for client-side auth checks
- Admin-only routes via `useAdminAuth()`

### Workflow Management
- Create workflows linked to a process, project, and package
- Template tasks are **copied** (not linked) when creating a workflow
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
