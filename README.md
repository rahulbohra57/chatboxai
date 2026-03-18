# LinkChat

A real-time, room-based chat application. Create a room, share the link, and start chatting — no account required.

Rooms support two access modes:

- **Open** — anyone with the link can join instantly
- **Secured** — users must provide the correct secret code to enter

---

## Features

- Instant room creation with a shareable URL
- Open and secured room modes
- Secret code hashing — plain codes are never stored or returned
- Guest identity via `localStorage` — no sign-up required
- Real-time message delivery via Supabase Realtime
- Full message history on load
- Long-form message support (no arbitrary text-length cap)
- Copy-to-clipboard room link button
- Rate limiting on room creation, join attempts, and message sending
- Responsive layout for desktop and mobile
- Loading, empty, and error states throughout
- Toast notifications for key actions

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui v4 + lucide-react |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime |
| Validation | Zod v4 |
| Forms | React Hook Form |
| Toasts | Sonner |
| Hashing | bcryptjs |
| Rate limiting | Supabase table (no external service) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Package manager | pnpm |
| Deployment | Vercel (free hobby) + Supabase (free tier) |

---

## Architecture Overview

**Server Actions handle all sensitive logic.** Room creation, join validation, and secret code comparison run server-side only. The Supabase admin client (service role key) is used for writes that bypass RLS, and is guarded with `server-only` to prevent accidental client-side imports.

**Guest identity** is stored in `localStorage` — a stable `guestId` and `displayName` are generated on first visit and reused on return. No authentication is required for the MVP.

**Realtime** uses Supabase's Postgres change subscriptions, scoped to the active room. Initial message history is fetched first; the realtime subscription is attached afterward. Messages are deduplicated by ID to handle any overlap between the initial fetch and live events.

**Rate limiting** uses a Supabase table to track request counts per IP, avoiding the need for an external Redis service.

---

## Folder Structure

```
src/
  app/
    page.tsx                    # Landing page
    create/
      page.tsx                  # Create room page
    room/
      [slug]/
        page.tsx                # Room join + chat page
        loading.tsx             # Suspense loading state
        error.tsx               # Route-level error boundary
    globals.css
    layout.tsx

  components/
    ui/                         # shadcn/ui primitives

  features/
    rooms/
      actions/                  # create-room, join-room server actions
      components/               # create-room-form, join-room-form, room-header, etc.
      lib/                      # room-queries (Supabase reads)
      schemas/                  # Zod schemas for room inputs
      types/                    # Room TypeScript types
    chat/
      actions/                  # send-message server action
      components/               # chat-room, message-list, message-item, message-composer, etc.
      hooks/                    # use-realtime-messages
      lib/                      # message-queries (Supabase reads)
      schemas/                  # Zod schemas for message inputs
      types/                    # Message TypeScript types

  lib/
    supabase/
      browser.ts                # Supabase client for browser components
      server.ts                 # Supabase client for server components / actions
      admin.ts                  # Supabase admin client (service role, server-only)
    auth/
      guest-session.ts          # Guest ID and display name helpers
    security/
      hash.ts                   # bcryptjs hash and compare
      rate-limit.ts             # Supabase-based rate limiter
      sanitize.ts               # Input sanitization helpers
    utils/
      slug.ts                   # Unique slug generation
      dates.ts                  # Date formatting helpers
      env.ts                    # Validated environment variable access
      cn.ts                     # Tailwind class merge utility

  types/
    database.ts                 # Generated/manual Supabase DB types

supabase/
  schema.sql                    # Tables, indexes, foreign keys
  policies.sql                  # Row-level security policies

tests/
  unit/                         # Vitest unit tests
  e2e/                          # Playwright E2E tests
```

---

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/linkchat.git
cd linkchat
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local` (see [Environment Variables](#environment-variables) below).

### 4. Set up Supabase

See [Supabase Setup](#supabase-setup) below.

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public URL of your app (e.g. `http://localhost:3000` locally, or your Vercel URL in production) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL — found in **Settings → API** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key — safe to expose to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-only, never expose to the browser** |

The `NEXT_PUBLIC_` prefix makes a variable available in client-side code. All other variables are server-only by convention and enforced via the `server-only` package on the admin client.

**`.env.local` is git-ignored and should never be committed.**

---

## Supabase Setup

### 1. Create a project

Go to [supabase.com](https://supabase.com) and create a new project on the free tier.

### 2. Run the schema

In the Supabase dashboard, open **SQL Editor** and run the contents of:

```
supabase/schema.sql
```

This creates the `rooms`, `messages`, and `participants` tables along with indexes and foreign keys.

### 3. Run the policies

Still in the SQL Editor, run:

```
supabase/policies.sql
```

This sets up Row Level Security policies for the tables.

### 4. Enable Realtime

In the Supabase dashboard:

1. Go to **Database → Replication**
2. Find the `messages` table
3. Toggle it on under **Supabase Realtime**

### 5. Copy your credentials

In the dashboard, go to **Settings → API** and copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

Paste these into your `.env.local`.

---

## Running Locally

```bash
# Start development server (with hot reload)
pnpm dev

# Run unit tests (Vitest)
pnpm test

# Run unit tests in watch mode
pnpm test:watch

# Build for production
pnpm build

# Start production build locally
pnpm start

# Lint
pnpm lint
```

For E2E tests with Playwright, ensure the dev server is running, then:

```bash
pnpm exec playwright test
```

---

## Deployment

### Supabase

The Supabase project you created during local setup is already production-ready on the free tier. No additional steps needed — it is accessible from any deployment.

### Vercel

1. Push your code to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, add all four variables from your `.env.local`.
5. Click **Deploy**.

Vercel will automatically build and deploy on every push to `main`.

After the first deploy, copy the production URL (e.g. `https://linkchat.vercel.app`) and:

- Set `NEXT_PUBLIC_APP_URL` to that URL in your Vercel environment variables
- Redeploy for the change to take effect

---

## Future Improvements

The following are out of scope for the MVP but the codebase is structured to support them:

- User authentication (replace guest identity with real accounts)
- Room ownership and admin controls (kick users, delete messages)
- Participant list and online presence indicators
- Typing indicators
- Message reactions and file attachments
- Room expiration and auto-cleanup
- PWA support for offline-capable mobile experience
- Message search
- Threaded replies
- Dark mode toggle
