# Application Blueprint: Kognitos-Powered Workflow Application

A complete set of instructions for building a domain-specific workflow application with a Next.js presentation layer and Kognitos "English as Code" business logic. This blueprint is domain-agnostic -- replace "Prior Authorization" with any process (claims adjudication, invoice approval, contract review, employee onboarding, compliance audit, etc.).

---

## Table of Contents

1. [Philosophy & Architecture](#1-philosophy--architecture)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Phase 0: Domain Analysis](#4-phase-0-domain-analysis)
5. [Phase 1: Scaffold the Application](#5-phase-1-scaffold-the-application)
6. [Phase 2: Design System](#6-phase-2-design-system)
7. [Phase 3: Domain Types, Seed Data & Supabase Schema](#7-phase-3-domain-types-seed-data--supabase-schema)
8. [Phase 4: API Abstraction Layer](#8-phase-4-api-abstraction-layer)
9. [Phase 5: Authentication & RBAC](#9-phase-5-authentication--rbac)
10. [Phase 6: Core Pages](#10-phase-6-core-pages)
11. [Phase 7: Kognitos Integration](#11-phase-7-kognitos-integration)
12. [Phase 8: Dynamic Metrics via SQL Queries](#12-phase-8-dynamic-metrics-via-sql-queries)
13. [Phase 9: Advanced Features](#13-phase-9-advanced-features)
14. [Conventions & Patterns Reference](#14-conventions--patterns-reference)
15. [Build Checklist](#15-build-checklist)

---

## 1. Philosophy & Architecture

### Separation of Concerns

The system has three layers:

- **Presentation Layer** (this app): Next.js on Vercel. Handles UI, routing, state, and data display. Does NOT encode business rules.
- **Business Logic Layer** (Kognitos): English-as-Code SOPs that are API-callable. Each SOP handles a step of the domain workflow. Edge cases and exceptions are handled internally by the SOPs.
- **Data Layer** (Supabase / Database): PostgreSQL tables that store the domain entities. SQL queries compute all metrics and aggregates -- no custom API endpoints for computed data.

### Key Principle

The presentation layer calls Kognitos SOPs via API to execute business logic and reads/writes data tables via SQL queries. Business rules live in the SOPs, not in TypeScript. The app is a workflow orchestrator and data viewer, not a rules engine.

```
┌─────────────────────────────────────────────────┐
│                 Presentation Layer               │
│          Next.js / Vercel / shadcn/ui            │
│                                                  │
│  Worklist ─ Detail ─ Dashboard ─ Rules ─ Settings│
└──────────────┬─────────────────┬─────────────────┘
               │ API calls       │ SQL queries
               ▼                 ▼
┌──────────────────────┐  ┌────────────────────────┐
│   Kognitos Platform  │  │   Database (Supabase)  │
│   English-as-Code    │  │   Domain tables         │
│   SOPs & Runs        │  │   Metrics via SQL       │
└──────────────────────┘  └────────────────────────┘
```

### Supabase-First Data Layer

All runtime data is served from Supabase PostgreSQL — there is no mock-data fallback at runtime:
- `lib/supabase.ts` creates the Supabase client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `lib/db.ts` is the unified data-access layer; every function calls Supabase and throws if not configured
- `lib/queries.ts` contains async analytics functions that fetch from Supabase via `lib/db.ts`
- `lib/api/*.ts` re-exports `lib/db.ts` functions; pages always import from `@/lib/api`
- Mock data files in `lib/mock-data/` are retained only for two purposes: (1) the `scripts/seed.ts` database seeder, and (2) `MOCK_USERS` for the auth-context role switcher
- Kognitos API is still mocked with typed functions that return JSON data (`lib/kognitos/client.ts`)

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 15+ (App Router) | SSR, routing, server components |
| UI Components | shadcn/ui + Radix UI | Accessible component primitives |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Tables | TanStack Table | Sorting, filtering, pagination |
| Charts | Recharts | Dashboard visualizations |
| State | Zustand | Client-side state (filters, panels) |
| Dates | date-fns | Date formatting and math |
| Icons | Lucide React | Consistent iconography |
| Database Client | @supabase/supabase-js | Supabase PostgreSQL access |
| Auth | React Context (mock role switcher) / Supabase Auth (production) | Role-based authentication |
| Database | Supabase PostgreSQL (all environments) | Domain entity storage |
| Business Logic | Kognitos REST API (mock client during dev) | SOP execution, run management |

### Dependencies (package.json)

```json
{
  "dependencies": {
    "@tanstack/react-table": "^8",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "cmdk": "^1",
    "date-fns": "^4",
    "lucide-react": "^0.575",
    "next": "^16",
    "radix-ui": "^1",
    "react": "^19",
    "react-dom": "^19",
    "recharts": "^3",
    "tailwind-merge": "^3",
    "zustand": "^5",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "shadcn": "^3",
    "tailwindcss": "^4",
    "tw-animate-css": "^1",
    "typescript": "^5"
  }
}
```

---

## 3. Project Structure

```
app-name/
├── app/
│   ├── layout.tsx                          # Root layout (AuthProvider, metadata, fonts)
│   ├── globals.css                         # Tailwind imports, theme tokens, fonts
│   ├── (auth)/
│   │   └── login/page.tsx                  # Login with role selector
│   └── (dashboard)/
│       ├── layout.tsx                      # Sidebar + Topbar shell + page guard
│       ├── page.tsx                        # Worklist (default landing)
│       ├── [entity]/[id]/page.tsx          # Entity detail (tabbed)
│       ├── dashboard/page.tsx              # Analytics dashboard
│       ├── rules/page.tsx                  # SOP/Rules browser
│       ├── rules/[id]/page.tsx             # Rule detail + run history
│       ├── notifications/page.tsx          # Notification history
│       └── settings/page.tsx               # Org settings
│           ├── users/page.tsx
│           └── [domain-config]/page.tsx
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                     # Nav sidebar (role-filtered)
│   │   └── topbar.tsx                      # Search, notifications, user menu
│   ├── ui/                                 # shadcn/ui components (badge, button, card, etc.)
│   ├── [domain]/                           # Domain-specific components
│   │   ├── status-badge.tsx                # Status → badge mapping
│   │   ├── priority-badge.tsx
│   │   ├── confidence-score.tsx
│   │   ├── criterion-card.tsx              # Checklist item display
│   │   └── timeline-event.tsx              # Audit log event
│   └── worklist/
│       ├── worklist-filters.tsx            # Filter bar
│       └── worklist-table.tsx              # TanStack Table
├── lib/
│   ├── types.ts                            # All domain types
│   ├── constants.ts                        # Role labels, status labels, etc.
│   ├── utils.ts                            # cn() and helpers
│   ├── supabase.ts                         # Supabase client (from env vars)
│   ├── db.ts                               # Data-access layer (all reads via Supabase)
│   ├── auth-context.tsx                    # React Context for auth
│   ├── role-permissions.ts                 # RBAC config + helpers
│   ├── queries.ts                          # Async analytics query functions (via lib/db)
│   ├── api/                                # Async API abstraction (re-exports lib/db)
│   │   ├── index.ts                        # Re-exports all API functions
│   │   ├── [entity].ts                     # Per-entity API module
│   │   └── ...
│   ├── kognitos/                           # Kognitos API client (mock)
│   │   ├── client.ts                       # getRun, listRuns, getRunEvents, etc.
│   │   └── index.ts                        # Re-exports
│   └── mock-data/                          # Seed data & auth mock only
│       ├── index.ts                        # Re-exports + MOCK_USERS for auth
│       ├── [entity].ts                     # Per-entity data arrays (seed source)
│       └── kognitos.ts                     # Mock runs, events, insights, metrics
├── supabase/
│   └── migrations/
│       └── [timestamp]_init.sql            # PostgreSQL schema (all tables, enums, RLS)
├── scripts/
│   └── seed.ts                             # Upserts mock data into Supabase
├── public/
│   └── fonts/                              # Custom font files
└── [domain]-docs/
    ├── PRD.md                              # Product Requirements Document
    ├── PRESENTATION.md                     # Presentation layer PRD
    └── BUSINESS_LOGIC.md                   # Business logic PRD (SOP definitions)
```

---

## 4. Phase 0: Domain Analysis

Before writing any code, create three documents:

### 4.1 Domain Process Map

Identify the core workflow of the domain. Map out:

- **Entity lifecycle**: What statuses does the primary entity go through? (e.g., `draft → submitted → under_review → approved → closed`)
- **Actors/roles**: Who interacts with the system? (e.g., Submitter, Reviewer, Manager, Admin)
- **Decision points**: Where does business logic live? These become SOPs.
- **External systems**: What integrations exist? (e.g., payer portals, EHR, HRIS)

### 4.2 Business Logic PRD (BUSINESS_LOGIC.md)

Define each SOP that will run on Kognitos:

```markdown
## SOP: [sop-name]
- **Trigger**: What starts this SOP
- **Inputs**: What data it receives
- **Logic**: What it does (in English)
- **Outputs**: What it produces (key-value pairs)
- **Edge Cases**: What exceptions it handles internally
```

Map SOPs to Kognitos concepts:
- SOPs → Kognitos automations within a workspace
- SOP runs → Kognitos Runs API (`GET /runs/{id}`)
- Line-level results → Kognitos Run Events API (`GET /runs/{id}/events`)
- Human input needed → `awaitingGuidance` state
- Metrics → Kognitos Dashboard & Analytics APIs

### 4.3 Presentation PRD (PRESENTATION.md)

Define the screens, their data sources, and their relationship to the SOPs:

- **Worklist**: Primary screen showing all entities with filters/sort/search
- **Entity Detail**: Tabbed view with all related data and action sidebar
- **Dashboard**: KPI cards + charts sourced from SQL queries and Kognitos analytics
- **Rules/SOPs**: Browser for viewing SOP definitions and their execution history
- **Notifications**: Real-time alerts for status changes and SLA breaches
- **Settings**: Organization, users, and domain configuration

---

## 5. Phase 1: Scaffold the Application

### 5.1 Create the Next.js App

```bash
npx create-next-app@latest app-name --typescript --tailwind --eslint --app --src=false
cd app-name
```

### 5.2 Install Dependencies

```bash
npm install @tanstack/react-table recharts zustand date-fns lucide-react cmdk
npx shadcn@latest init
```

### 5.3 Install shadcn Components

```bash
npx shadcn@latest add badge button card checkbox command dialog dropdown-menu \
  input label popover scroll-area select separator sheet skeleton table tabs \
  textarea tooltip avatar
```

### 5.4 Create Directory Structure

Create the folder structure from Section 3. Set up route groups `(auth)` and `(dashboard)`.

---

## 6. Phase 2: Design System

### 6.1 Custom Fonts

Place font files in `public/fonts/`. Add `@font-face` declarations in `globals.css`.

### 6.2 Theme Tokens

In `globals.css`, define the theme using Tailwind v4's `@theme inline`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --font-sans: 'Your Font', sans-serif;
  --font-mono: 'Your Mono Font', monospace;
  --radius-sm: var(--radius);
  --radius-md: calc(var(--radius) + 2px);
  --radius-lg: calc(var(--radius) + 4px);
  /* Semantic colors using OKLCH */
  --color-brand: oklch(...);
  --color-success: oklch(...);
  --color-warning: oklch(...);
  --color-destructive: oklch(...);
}

:root {
  --radius: 0.375rem;       /* tighter border radii */
  --background: oklch(...);
  --foreground: oklch(...);
  --primary: oklch(...);
  /* ... all shadcn color variables ... */
}
```

### 6.3 Color Palette

Use OKLCH color space for perceptual uniformity. Define:
- Brand color (primary actions, active states)
- Success, Warning, Destructive (status indicators)
- Sidebar colors (background, accent, muted)
- Chart palette (8-10 distinct colors for visualizations)

---

## 7. Phase 3: Domain Types, Seed Data & Supabase Schema

### 7.1 Define Types (`lib/types.ts`)

Start with the core domain entity and work outward:

```typescript
// 1. Status enum (discriminated union)
export type EntityStatus = "draft" | "submitted" | "under_review" | "approved" | "denied" | "closed";

// 2. Role enum
export type UserRole = "submitter" | "reviewer" | "manager" | "admin";

// 3. Priority, category, and other enums
export type Priority = "urgent" | "standard";

// 4. Core domain entity (the "case" equivalent)
export interface DomainEntity {
  id: string;
  org_id: string;
  // ... domain-specific fields
  status: EntityStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  kognitos_run_id: string;  // links to Kognitos run
}

// 5. Related entities
export interface ChecklistItem { ... }
export interface Submission { ... }
export interface AuditEvent { ... }

// 6. Kognitos types (standard across all domains)
export interface KognitosRun {
  name: string;
  createTime: string;
  updateTime: string;
  state: {
    pending?: Record<string, never>;
    executing?: Record<string, never>;
    awaitingGuidance?: { exception: string; description: string };
    completed?: { outputs: Record<string, string> };
    failed?: { id: string; description: string };
  };
  stage: string;
  stageVersion: string;
  invocationDetails: { invocationSource: string };
  userInputs: Record<string, string>;
}

export interface KognitosRunEvent {
  id: string;
  runId: string;
  timestamp: string;
  type: "runUpdate" | "executionJournal";
  nodeKind?: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface KognitosInsights { ... }
export interface KognitosMetricResult { ... }

// 7. User and auth
export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}
```

### 7.2 Create Supabase Schema (`supabase/migrations/`)

Map every TypeScript type to a PostgreSQL table. Use `supabase db push` to apply:

```sql
-- Use PostgreSQL ENUMs for status/priority string unions
CREATE TYPE entity_status AS ENUM ('draft','submitted','under_review','approved','denied','closed');
CREATE TYPE priority AS ENUM ('urgent','standard');

-- Core entity table
CREATE TABLE entities (
  id                    text PRIMARY KEY,
  org_id                text NOT NULL REFERENCES organizations(id),
  status                entity_status NOT NULL DEFAULT 'draft',
  priority              priority NOT NULL DEFAULT 'standard',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  assigned_to           text REFERENCES users(id),
  kognitos_run_id       text,
  -- domain-specific columns...
);

-- Enable RLS on all tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON entities FOR SELECT USING (true);
```

**Schema guidelines:**
- Use `text` primary keys matching the TypeScript `id` field
- Use `jsonb` for flexible nested objects (e.g., `eligibility_status`, `criteria_summary`)
- Add foreign key constraints for all relationships
- Create indexes on frequently filtered columns (`status`, `payer_id`, `assigned_to`)
- Enable Row Level Security on all tables

### 7.3 Create Seed Data (`lib/mock-data/` + `scripts/seed.ts`)

Mock data files in `lib/mock-data/` serve as the **seed source**. For each entity type, create a `.ts` file exporting a typed array:

```typescript
// lib/mock-data/entities.ts
import type { DomainEntity } from "@/lib/types";

export const entities: DomainEntity[] = [
  { id: "entity-1", status: "approved", ... },
  { id: "entity-2", status: "submitted", ... },
  // 20-60 records covering all statuses and edge cases
];
```

**Guidelines for seed data:**
- Cover every status in the lifecycle
- Include at least 3-5 records per status
- Ensure foreign keys are consistent (entity → user, entity → related records)
- Every entity should have a `kognitos_run_id` linking to a mock run
- Mock runs should have outputs that are consistent with the entity's database state
- Include realistic dates, names, and values

### 7.4 Database Seeder (`scripts/seed.ts`)

A TypeScript script that upserts all mock data into Supabase using the service role key:

```typescript
import { createClient } from "@supabase/supabase-js";
// import all mock data arrays...

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // bypasses RLS
  { auth: { persistSession: false } }
);

async function upsert(table: string, rows: Record<string, unknown>[]) {
  const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

async function main() {
  // Upsert in dependency order (parents before children)
  await upsert("organizations", [...]);
  await upsert("users", [...]);
  await upsert("entities", [...]);
  // ... all other tables
}

main().catch(console.error);
```

Run with: `SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts`

### 7.5 Supabase Client (`lib/supabase.ts`)

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
```

### 7.6 Data Access Layer (`lib/db.ts`)

All runtime data reads go through this module. Every function calls Supabase directly:

```typescript
import { supabase } from "./supabase";
import type { DomainEntity, User } from "./types";

function sb() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function getAllEntities(): Promise<DomainEntity[]> {
  const { data, error } = await sb().from("entities").select("*");
  if (error) throw error;
  return data as DomainEntity[];
}

export async function getEntityById(id: string): Promise<DomainEntity | undefined> {
  const { data, error } = await sb().from("entities").select("*").eq("id", id).single();
  if (error) return undefined;
  return data as DomainEntity;
}

// ... similar functions for all entity types and relationships
```

**Important:** `lib/db.ts` does NOT import from `lib/mock-data/`. There is no fallback — if Supabase is not configured, functions throw. Mock data files are only used by the seed script and the auth context role switcher.

---

## 8. Phase 4: API Abstraction Layer

### 8.1 API Module (`lib/api/`)

Re-export `lib/db.ts` async functions. This keeps a clean import boundary for pages:

```typescript
// lib/api/entities.ts
import type { DomainEntity } from "@/lib/types";
import { getAllEntities, getEntityById as _getEntityById } from "@/lib/db";

export async function listEntities(): Promise<DomainEntity[]> {
  return getAllEntities();
}

export async function getEntityById(id: string): Promise<DomainEntity | undefined> {
  return _getEntityById(id);
}
```

### 8.2 API Index (`lib/api/index.ts`)

Re-export everything so pages import from a single path:

```typescript
export { listEntities, getEntityById, ... } from "./entities";
export { listUsers, getUserById, getUserForRole } from "./users";
export { queryInsights, queryMetrics, getRun, listRuns, getRunEvents } from "@/lib/kognitos";
```

**Rules:**
- Pages always import from `@/lib/api`, never from `@/lib/db` or `@/lib/mock-data` directly
- All functions are async (return Promises) since they fetch from Supabase
- No synchronous data accessors (e.g., no `getUserByIdSync`) — all lookups are async
- The only exception: `getUserForRole()` uses the static `MOCK_USERS` map from `lib/mock-data` for the auth context role switcher

---

## 9. Phase 5: Authentication & RBAC

### 9.1 Auth Context (`lib/auth-context.tsx`)

```typescript
"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Restore from localStorage on mount
    const stored = localStorage.getItem("app_user");
    if (stored) setUser(JSON.parse(stored));
    setHydrated(true);
  }, []);

  const login = useCallback((role: UserRole) => {
    const mockUser = getUserForRole(role); // from API
    setUser(mockUser);
    localStorage.setItem("app_user", JSON.stringify(mockUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("app_user");
  }, []);

  if (!hydrated) return null;

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

### 9.2 Role Permissions (`lib/role-permissions.ts`)

Define a centralized config mapping each role to:
- **allowedPaths**: Which sidebar nav items to show (and which pages to allow)
- **defaultPath**: Where to redirect after login
- **actions**: Which entity actions are enabled (e.g., submit, assign, escalate, cancel)

```typescript
import type { UserRole } from "@/lib/types";

export type EntityAction = "submit" | "assign" | "escalate" | "cancel" | "create" | ...;

export const ROLE_PERMISSIONS: Record<UserRole, {
  allowedPaths: string[];
  defaultPath: string;
  actions: EntityAction[] | ["*"];
}> = {
  submitter: {
    allowedPaths: ["/", "/entities", "/notifications"],
    defaultPath: "/",
    actions: ["submit", "assign", "create"],
  },
  reviewer: {
    allowedPaths: ["/", "/entities", "/rules", "/notifications"],
    defaultPath: "/",
    actions: ["assign", "escalate"],
  },
  manager: {
    allowedPaths: ["/", "/entities", "/dashboard", "/rules", "/notifications", "/settings"],
    defaultPath: "/dashboard",
    actions: ["assign"],
  },
  admin: {
    allowedPaths: ["*"],
    defaultPath: "/dashboard",
    actions: ["*"],
  },
};

export function canAccessPath(role: UserRole, path: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.allowedPaths.includes("*")) return true;
  const normalised = path.replace(/\/$/, "") || "/";
  return perms.allowedPaths.some((a) =>
    a === "/" ? normalised === "/" : normalised === a || normalised.startsWith(a + "/")
  );
}

export function canPerformAction(role: UserRole, action: EntityAction): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return (perms.actions as string[]).includes("*") || (perms.actions as EntityAction[]).includes(action);
}

export function getDefaultPath(role: UserRole): string {
  return ROLE_PERMISSIONS[role].defaultPath;
}
```

### 9.3 Where RBAC Is Enforced

| Location | What it does |
|----------|-------------|
| `app/(auth)/login/page.tsx` | Calls `getDefaultPath(role)` after login to redirect to the right page |
| `app/(dashboard)/layout.tsx` | Checks `canAccessPath(user.role, pathname)` on every navigation; redirects unauthorized roles |
| `components/layout/sidebar.tsx` | Filters `NAV_ITEMS` array with `canAccessPath(user.role, item.href)` |
| Entity detail action sidebar | Wraps each button with `canPerformAction(role, "action")` |
| Worklist page | Conditionally hides "New Entity" and "Export" buttons based on role |
| Dashboard page | Reorders/hides sections based on role (e.g., financial-first for billing) |

---

## 10. Phase 6: Core Pages

### 10.1 Login Page

- Role selector dropdown (no real credentials for mock)
- On submit: `login(role)` then `router.push(getDefaultPath(role))`
- Styled as a centered card with the app logo

### 10.2 Dashboard Layout (`app/(dashboard)/layout.tsx`)

```typescript
"use client";
export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (!canAccessPath(user.role, pathname)) { router.replace(getDefaultPath(user.role)); }
  }, [user, router, pathname]);

  if (!user || !canAccessPath(user.role, pathname)) return null;

  return (
    <div className="min-h-svh bg-muted/30">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 10.3 Worklist (Primary Screen)

The worklist is the default page for most roles. It contains:

1. **Header**: Title, entity count, action buttons (New Entity, Export CSV)
2. **Filter bar**: Search input, status multi-select, category dropdown, priority toggle, clear button
3. **Table**: TanStack Table with sortable columns, row selection, pagination, row-click navigation
4. **Role awareness**: Physicians/read-only roles see filtered data and no action buttons

**Filter pattern**: Controlled state with `WorklistFilters` interface:

```typescript
interface WorklistFilters {
  search: string;
  statuses: EntityStatus[];
  categoryId: string | null;
  priority: Priority | null;
}
```

### 10.4 Entity Detail (Tabbed)

The most complex page. Structure:

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Worklist                                     │
├─────────────────────────────────────────────┬───────────┤
│  Header Card (entity info, status, badges)  │ Actions   │
├─────────────────────────────────────────────┤ Sidebar   │
│  Tabs:                                      │           │
│  ┌─────────────────────────────────────────┐│ Submit    │
│  │ Overview | Documents | Submissions |    ││ Assign    │
│  │ Denials | Queries | Timeline | Letters  ││ Escalate  │
│  │ | SOP Run                               ││ Cancel    │
│  └─────────────────────────────────────────┘│           │
│  Tab Content                                │ Quick Info│
└─────────────────────────────────────────────┴───────────┘
```

**Tab patterns:**
- **Overview**: Checklist cards (met/unmet), gaps, next action recommendation, predictive scores, alternative suggestions
- **Documents**: File list with type badge, upload button
- **Submissions**: Timeline of attempts with channel icon, status
- **Issues & Appeals**: Issue cards with classification, appeal editor
- **Queries**: Question cards with response field
- **Timeline**: Chronological audit log using `TimelineEvent` component
- **Letters**: Generated documents with regenerate/download
- **SOP Run**: Kognitos run visibility (see Phase 7)

**Action sidebar gating**: Each button wrapped in `canPerformAction(role, "action")`.

**URL deep-linking**: Read `useSearchParams().get("tab")` to set the default tab value, enabling `?tab=sop-run` links.

### 10.5 Dashboard

1. **KPI Cards** in a responsive grid (`grid-cols-2 md:grid-cols-3 xl:grid-cols-6`):
   - All values computed from SQL query functions, never hard-coded
   - Each card: label, value, icon, optional trend
   - Role-aware ordering (financial-first for billing roles)

2. **Charts** (2x2 grid using Recharts):
   - Line chart: Volume over time
   - Area chart: Approval vs denial trend (stacked)
   - Pie chart: Entities by status (with drill-down on click)
   - Bar chart: Issue breakdown (with drill-down on click)

3. **Tables**:
   - Performance by category (e.g., payer, department, vendor)
   - Eligibility/thresholds (e.g., gold card, fast-track)
   - Team productivity

4. **Interactive drill-down**: Clicking any chart element or table row opens a `Sheet` sliding in from the right showing a filtered table of entities. Use `useState<{ title: string; entities: Entity[] } | null>(null)` for drill-down state.

5. **Role awareness**:
   - Manager roles see Team Productivity first
   - Financial roles see revenue KPIs first
   - Some sections hidden for non-applicable roles

### 10.6 Rules/SOPs Browser

- List page: Cards per rule grouped by category with computed metrics (approval rate, hit rate, gap rate)
- Detail page: Rule content with keyword highlighting, version history sidebar, metrics sidebar
- **Run History** section below the rule content showing all Kognitos runs that used that rule, as an expandable table with inline input/output details

### 10.7 Notifications

- Bell icon in topbar with dynamic unread count (`queryUnreadNotificationCount(user.id)`)
- Full page: Tabs for All/Unread, alert cards for SLA breaches, notification list with mark-as-read

### 10.8 Settings

- Organization info form (name, identifiers, address)
- Users table with role badges
- Domain config table (e.g., payers, departments, vendors)

---

## 11. Phase 7: Kognitos Integration

### 11.1 Mock Kognitos Client (`lib/kognitos/client.ts`)

Mirror the Kognitos REST API with mock functions:

```typescript
// Each function documents the HTTP endpoint it simulates
/** Simulates GET /api/v1/.../runs/{run_id} */
export async function getRun(runId: string): Promise<KognitosRun | null> { ... }

/** Simulates GET /api/v1/.../runs */
export async function listRuns(options?: { pageSize?: number; filter?: string }): Promise<{ runs: KognitosRun[]; nextPageToken: string | null }> { ... }

/** Simulates GET /api/v1/.../runs/{run_id}/events */
export async function getRunEvents(runId: string): Promise<{ runEvents: KognitosRunEvent[]; nextPageToken: string | null }> { ... }

/** Simulates GET /api/v1/.../dashboards:queryInsights */
export async function queryInsights(): Promise<KognitosInsights> { ... }

/** Simulates GET /api/v1/.../metrics:query */
export async function queryMetrics(options?: { metrics?: string[]; groupBy?: string[] }): Promise<{ results: KognitosMetricResult[] }> { ... }

/** Simulates GET /api/v1/.../workspaces:automationRunAggregates */
export async function getAutomationRunAggregates(): Promise<...> { ... }
```

### 11.2 Mock Run Data Consistency

Every mock run's `state.completed.outputs` should match the corresponding entity's data in the database tables. This demonstrates that the SOP produced the outputs that were then stored in the database. For example:

```typescript
// Run outputs
outputs: {
  status: "approved",
  rule_id: "rule-1",
  confidence_score: "82",
  auth_number: "AUTH-2026-001",
}

// Corresponding entity in the database
{ id: "entity-1", status: "approved", confidence_score: 82, auth_number: "AUTH-2026-001", kognitos_run_id: "run-1" }
```

### 11.3 SOP Run Tab on Entity Detail Page

Add a tab that shows the Kognitos run for this entity:

1. **Run Summary Card**: Status badge, duration, stage version, run ID
2. **Inputs Card**: Key-value display of `run.userInputs`
3. **Outputs Card**: Key-value display grouped by SOP phase (e.g., Eligibility, Criteria, Submission, Decision) with boolean values rendered as Yes/No badges
4. **Execution Trace**: Collapsible chronological timeline of `KognitosRunEvent[]`:
   - `runUpdate` events as milestone markers (larger icons, bold text)
   - `executionJournal` events as step items with decision/action icons
   - SOP badges colored by phase name
   - Expandable JSON details per event

### 11.4 Run History on Rule Detail Page

Show all runs that used a specific rule:
- Table with: Run ID, Entity Name, Key Code, Status, Confidence, Duration, Date
- Rows are expandable to show inline inputs/outputs (two-column layout)
- Link to the entity's SOP Run tab via `?tab=sop-run`

---

## 12. Phase 8: Dynamic Metrics via SQL Queries

### 12.1 Query Module (`lib/queries.ts`)

All query functions are **async** — they fetch data from Supabase via `lib/db.ts`, then compute metrics in JavaScript:

```typescript
/**
 * Async query functions — all data fetched from Supabase via lib/db.
 */
import { getAllCases, getAllDenials, getAllNotifications } from "@/lib/db";

export async function queryAvgTimeToDecision(): Promise<number> {
  const cases = await getAllCases();
  const withDates = cases.filter((c) => c.decided_at && c.submitted_at);
  if (withDates.length === 0) return 0;
  const totalDays = withDates.reduce((sum, c) => {
    return sum + (new Date(c.decided_at!).getTime() - new Date(c.submitted_at!).getTime()) / 86_400_000;
  }, 0);
  return totalDays / withDates.length;
}

export async function queryFirstPassApprovalRate(): Promise<number> { ... }

export async function queryIssueBreakdown(): Promise<{ reason: string; value: number }[]> { ... }

export async function queryUnreadNotificationCount(userId: string): Promise<number> {
  const notifs = await getAllNotifications();
  return notifs.filter((n) => n.user_id === userId && !n.is_read).length;
}
```

**Key pattern:** Functions that need multiple tables use `Promise.all` to fetch in parallel:
```typescript
export async function queryDenialsByPayerService(): Promise<DenialByPayerService[]> {
  const [cases, denials] = await Promise.all([getAllCases(), getAllDenials()]);
  // ... compute metrics from both arrays
}
```

### 12.2 Zero Hard-Coded Metrics Rule

**Every number displayed in the UI must come from a query function or the Kognitos API.** No hard-coded statistics, percentages, or counts anywhere in page components. If a metric appears on screen, there must be a function computing it from data.

### 12.3 Kognitos Analytics Consistency

Update mock Kognitos insights and metrics to match the actual mock data:
- `totalRunsCount` = number of mock runs
- `totalMoneySavedUsd` = sum of revenue from approved entities
- Completion rates = computed from run states
- Time-series = computed by bucketing runs by `createTime`

---

## 13. Phase 9: Advanced Features

### 13.1 Interactive Dashboard Drill-Down

When the user clicks a chart segment, bar, table row, or data point, a `Sheet` component slides in from the right showing the matching entities:

```typescript
const [drillDown, setDrillDown] = useState<{ title: string; entities: Entity[] } | null>(null);

// In a PieChart onClick:
onClick={(data) => {
  setDrillDown({
    title: `Entities — ${data.name} (${data.value})`,
    entities: allEntities.filter((e) => e.status === data.status),
  });
}}

// Sheet component:
<Sheet open={drillDown !== null} onOpenChange={(open) => { if (!open) setDrillDown(null); }}>
  <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl">
    <SheetHeader><SheetTitle>{drillDown?.title}</SheetTitle></SheetHeader>
    {drillDown && <DrillDownTable entities={drillDown.entities} />}
  </SheetContent>
</Sheet>
```

### 13.2 Expandable Table Rows

For detailed data like run history, use expandable rows with `React.Fragment`:

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);

{items.map((item) => (
  <React.Fragment key={item.id}>
    <tr onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="cursor-pointer">
      <td><ChevronDown/ChevronUp icon /></td>
      {/* ... columns ... */}
    </tr>
    {expandedId === item.id && (
      <tr><td colSpan={N} className="bg-muted/30 p-4"><DetailPanel item={item} /></td></tr>
    )}
  </React.Fragment>
))}
```

### 13.3 Global Search

Topbar search navigates to the worklist with a URL query param:

```typescript
function handleSearchKeyDown(e: React.KeyboardEvent) {
  if (e.key === "Enter") {
    router.push(`/?search=${encodeURIComponent(searchValue)}`);
  }
}
```

The worklist reads `useSearchParams().get("search")` and applies it to filters.

### 13.4 CSV Export

```typescript
function exportToCSV(entities: Entity[]) {
  const headers = ["ID", "Name", "Status", ...];
  const rows = entities.map((e) => [e.id, e.name, e.status, ...]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "export.csv"; a.click();
  URL.revokeObjectURL(url);
}
```

### 13.5 Predictive Scoring

Query historical approval rates for the same combination of attributes:

```typescript
export async function queryPredictiveScore(codes: string[], categoryId: string): Promise<{
  predicted_approval_pct: number;
  risk_label: "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK";
  historical_decided: number;
}> { ... }
```

### 13.6 Threshold / Gold Card Engine

Track approval rates by actor + code + category and flag high-performers:

```typescript
export async function queryGoldCardEligibility(): Promise<{
  actor_id: string; actor_name: string; code: string; category_id: string;
  total_decided: number; approval_rate: number; eligible: boolean;
}[]> { ... }
```

### 13.7 Entity Creation Dialog

A `Dialog` with a form that creates a new entity in the local state:
- Key fields: name, category, codes, priority, estimated value
- On submit: adds to `allEntities` state, closes dialog, shows success alert

### 13.8 Episode/Bundle Grouping

Add an `episode_id` field to the entity type to group related entities:

```typescript
export async function queryEpisodes(): Promise<{
  episode_id: string; entity_name: string;
  entities: Entity[]; total_value: number;
}[]> { ... }
```

Display as cards in the worklist page above the filter bar.

---

## 14. Conventions & Patterns Reference

### Naming

| Item | Convention | Example |
|------|-----------|---------|
| Types | PascalCase | `PACase`, `DomainEntity` |
| Status enums | snake_case string unions | `"ready_to_submit"` |
| Mock data files | kebab-case | `criteria-matches.ts` |
| API functions | camelCase, verb-first | `getCaseById`, `listCases` |
| Query functions | `query` prefix | `queryDenialRate()` |
| Components | PascalCase files | `StatusBadge.tsx` |
| Route params | `[id]` folders | `cases/[id]/page.tsx` |

### Import Order

1. React / Next.js
2. Third-party (date-fns, lucide-react)
3. Internal lib (api, queries, auth, permissions)
4. UI components (shadcn)
5. Domain components
6. Types (with `import type`)

### Component Patterns

- Pages are `"use client"` with `useState` + `useEffect` for data fetching
- All data (including query/metrics) fetched via `useEffect` calling async functions
- Batch multiple independent async calls with `Promise.all` in a single `useEffect`
- `useMemo` only for **synchronous** derivations from already-loaded state — never for async calls
- All `useState`/`useEffect` hooks must appear **before** any conditional early returns
- Status badges use a config object mapping status → variant + label
- Cards use shadcn `Card` / `CardHeader` / `CardContent` / `CardTitle`
- Tables use shadcn `Table` or TanStack Table for complex tables
- Tabs use shadcn `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`

### Data Flow

All data loading is async — no synchronous data accessors exist at runtime:

```
Page (useEffect) → API function (async) → lib/db (async) → Supabase PostgreSQL
Page (useEffect) → Query function (async) → lib/db (async) → Supabase PostgreSQL → JS compute
Page (useEffect) → Kognitos client (async) → Mock JSON (dev) / Kognitos REST API (prod)
```

**React hooks rule**: All `useEffect` and `useState` hooks for data loading must be declared **before** any conditional early returns (`if (!data) return null`). Placing a `useEffect` after an early return causes "Rendered more hooks than during the previous render" errors.

```typescript
// CORRECT: all hooks before early returns
const [data, setData] = useState(null);
const [extra, setExtra] = useState(null);

useEffect(() => { fetchData().then(setData); }, []);
useEffect(() => { if (data) fetchExtra(data.id).then(setExtra); }, [data]);

if (!data) return null;  // early return is safe — hooks are already registered

// WRONG: hook after early return
useEffect(() => { fetchData().then(setData); }, []);
if (!data) return null;
useEffect(() => { ... }, [data]);  // ← React error: hook count changes between renders
```

---

## 15. Build Checklist

### Foundation
- [ ] Create Next.js app with TypeScript and Tailwind
- [ ] Install all dependencies
- [ ] Add shadcn components
- [ ] Set up custom fonts and design tokens in globals.css
- [ ] Create directory structure

### Domain Model & Database
- [ ] Define all types in `lib/types.ts`
- [ ] Create Supabase project and link (`supabase link --project-ref <ref>`)
- [ ] Write SQL migration mapping all types to tables (`supabase/migrations/`)
- [ ] Push schema to Supabase (`supabase db push`)
- [ ] Create seed data arrays in `lib/mock-data/` (20-60 records each)
- [ ] Create Kognitos mock data (runs, events, insights, metrics)
- [ ] Ensure run outputs match entity data in tables
- [ ] Write and run `scripts/seed.ts` to populate Supabase
- [ ] Create `lib/supabase.ts` (client from env vars)
- [ ] Create `lib/db.ts` (async data-access layer, Supabase-only, no mock fallback)

### API & Auth
- [ ] Create API abstraction layer (`lib/api/`)
- [ ] Create Kognitos mock client (`lib/kognitos/client.ts`)
- [ ] Create auth context with localStorage persistence
- [ ] Create role permissions config
- [ ] Create constants (role labels, status labels)

### Core Pages
- [ ] Root layout with AuthProvider
- [ ] Login page with role selector and role-based redirect
- [ ] Dashboard layout with sidebar, topbar, and page guard
- [ ] Sidebar with role-filtered navigation
- [ ] Topbar with search, notifications badge, user dropdown
- [ ] Worklist with filters, table, CSV export, new entity dialog
- [ ] Entity detail with tabbed view and action sidebar
- [ ] Dashboard with KPI cards, charts, tables, drill-down sheets
- [ ] Rules/SOPs browser with detail page
- [ ] Notifications page with SLA alerts
- [ ] Settings page with org info and user management

### Intelligence Layer
- [ ] Async query module (`lib/queries.ts`) — all functions async, fetch from Supabase via `lib/db`
- [ ] Zero hard-coded metrics — every number from a query function or Kognitos API
- [ ] Kognitos analytics data consistent with mock runs
- [ ] SOP Run tab on entity detail page
- [ ] Run History section on rule detail page with expandable rows
- [ ] Predictive scoring
- [ ] Threshold/gold card engine
- [ ] Advanced analytics (trends, breakdowns, productivity)

### RBAC
- [ ] Sidebar filtering by role
- [ ] Login redirects to role-specific default page
- [ ] Page-level access guard in dashboard layout
- [ ] Action-level gating on entity detail page
- [ ] Role-specific worklist (e.g., physician sees only pending queries)
- [ ] Role-aware dashboard (section ordering/visibility)

### Deployment
- [ ] Set Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Pull env vars locally: `vercel env pull .env.local`
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Verify all pages load data from Supabase (no console errors)

### Polish
- [ ] Interactive drill-down on all dashboard visualizations
- [ ] URL deep-linking for tabs (?tab=sop-run)
- [ ] Global search navigating to worklist with filter
- [ ] Episode/bundle grouping in worklist
- [ ] Renewal/follow-up management
- [ ] All `useEffect`/`useState` hooks declared before conditional returns
- [ ] All TypeScript compiles cleanly
- [ ] No lint errors
- [ ] Git init and commit
