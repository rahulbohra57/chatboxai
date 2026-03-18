# CLAUDE.md

## Project Name
ChatboxAI

## Product Summary
ChatboxAI is a real-time room-based chat application where users can create a room, share a link, and let others join the ongoing conversation instantly from any device.

Rooms support two access modes:
- **Open**: anyone with the link can join
- **Secured**: users must provide the correct secret code to join

This product is designed as a fast, low-friction, guest-first chat experience with a strong MVP architecture that can scale later into a richer collaboration platform.

---

## Primary Goal
Build a clean, production-style MVP with:
- instant room creation
- shareable links
- real-time chat
- support for long messages
- secure join flow for protected rooms
- responsive UI for desktop and mobile
- simple architecture that is easy to extend

---

## Preferred Stack

### Core stack
- **Framework:** Next.js 15 App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Component library:** shadcn/ui
- **Icons:** lucide-react
- **Database:** Supabase PostgreSQL
- **Realtime:** Supabase Realtime
- **Validation:** Zod
- **Forms:** React Hook Form
- **Notifications:** Sonner
- **Hashing:** bcryptjs
- **Rate limiting:** Upstash Redis
- **Monitoring:** Sentry
- **Testing:** Vitest, React Testing Library, Playwright
- **Deployment:** Vercel + Supabase
- **Package manager:** pnpm

### Avoid unless necessary
- Redux
- Zustand for simple local state
- Separate Express/FastAPI backend
- Overengineered repository/service abstractions
- Complex CQRS/event-driven patterns for MVP

Keep the codebase simple and maintainable.

---

## Product Requirements

### Core user flows

#### 1. Create room
User can create a room with:
- room name
- room type: Open or Secured
- optional secret code if room is Secured

System must:
- generate a unique shareable slug
- save room in the database
- return a shareable room URL
- redirect creator into the room after creation

#### 2. Join room
User opens a room URL.

For **Open** rooms:
- ask for display name
- join directly

For **Secured** rooms:
- ask for display name
- ask for secret code
- validate code server-side
- allow join only if valid

#### 3. Chat in room
Inside a room:
- users see historical messages
- users receive new messages in realtime
- messages display sender and timestamp
- users can send messages with no arbitrary text-length restriction
- users can copy the room link
- UI works well on mobile and desktop

---

## MVP Scope
Build these first:
- landing page
- create room flow
- room join flow
- secured room validation
- realtime message updates
- message history fetch
- message composer
- share/copy link
- basic guest identity persistence
- mobile responsiveness
- basic abuse/rate limiting
- clear loading/error states

---

## Post-MVP Scope
Design for these later, but do not overbuild now:
- user authentication
- room ownership/admin controls
- participants list
- typing indicators
- presence / online status
- reactions
- attachments
- room expiration
- moderation / reporting
- PWA
- message search
- threaded replies

---

## Architecture Principles

### 1. Keep backend logic server-side
Use:
- **Server Actions** for create/join actions
- **Route Handlers** where HTTP endpoints are cleaner

Do not place sensitive access logic in client components.

### 2. Keep secured-room verification on the server
For secured rooms:
- hash secret codes before storing
- compare server-side only
- do not expose code validation logic to the client
- never store or send plain secret code back to browser

### 3. Use guest identity for MVP
Guest identity is enough initially.

Persist in browser:
- `guestId`
- `displayName`

Optionally persist:
- recently used display name
- last joined rooms

Do not require signup/login for MVP.

### 4. Prefer simple domain separation
Group code by feature and responsibility:
- room creation/join
- chat messaging
- shared utilities
- UI primitives

### 5. Prioritize correctness over abstraction
Prefer direct, readable code over premature abstraction.

---

## Non-Negotiable Security Rules
- Never store room secret codes in plain text
- Never trust client-side authorization checks
- Never expose Supabase service role key to the browser
- Validate all inputs with Zod
- Escape/sanitize displayed message content
- Rate-limit room creation, join attempts, and message sending
- Keep environment variables server-only where appropriate
- Do not log secret codes
- Do not return secret hashes in any API response

---

## Performance Rules
- Fetch initial room and message history efficiently
- Add indexes for frequently queried columns
- Subscribe to realtime only for the active room
- Clean up subscriptions on unmount
- Avoid unnecessary client re-renders
- Keep first-load performance strong on mobile
- Use pagination later only if needed; MVP can load recent message history directly

---

## UX Rules
- Room creation should feel fast and low-friction
- Joining a room should take as few steps as possible
- Open vs Secured room status must be visually obvious
- Use clear validation messages
- Message composer must feel responsive
- Auto-scroll to latest message unless user has intentionally scrolled up
- Layout should work well on narrow screens
- Show loading, empty, and error states everywhere needed
- Use polished toast notifications for major actions
- Keep UI modern, minimal, and uncluttered

---

## Data Model Guidance

### rooms table
Required fields:
- `id` UUID primary key
- `slug` unique text
- `name` text
- `room_type` text or enum (`open`, `secured`)
- `secret_code_hash` text nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- `created_by_guest_id` text nullable
- `is_active` boolean default true

### messages table
Required fields:
- `id` UUID primary key
- `room_id` UUID foreign key
- `sender_guest_id` text
- `sender_name` text
- `body` text
- `created_at` timestamptz default now()

### participants table (optional for MVP, recommended if easy)
Fields:
- `id` UUID primary key
- `room_id` UUID foreign key
- `guest_id` text
- `display_name` text
- `joined_at` timestamptz default now()
- `last_seen_at` timestamptz default now()

### join_attempts or audit table (optional)
Add later if needed for abuse monitoring.

---

## Database Rules
- Use PostgreSQL `text` for message content
- Use UUID primary keys
- Add unique index on `rooms.slug`
- Add index on `messages.room_id, created_at`
- Add foreign keys with cascade delete on messages when room is removed
- Use database constraints where helpful
- Keep schema easy to understand

---

## Realtime Rules
- Use Supabase Realtime for new message delivery
- Load initial message history first
- Then attach realtime subscription
- Scope subscription to current room only
- Deduplicate messages if initial fetch and realtime overlap
- Clean up subscription properly on page leave/unmount

---

## Routing Plan

### Public routes
- `/` → landing page
- `/create` → create room page
- `/room/[slug]` → join + chat experience

### Optional API / server endpoints
- room creation
- room join validation
- message creation
- room metadata fetch

Prefer Server Actions first where it keeps code simpler.

---

## State Management Rules
Default to:
- React state
- server actions
- client hooks

Do not add a global state library unless clearly needed.

Possible local state:
- join form state
- active room messages
- subscription status
- composer state
- optimistic message state if implemented

---

## Form and Validation Rules
Use:
- `react-hook-form`
- `zod`
- `@hookform/resolvers/zod`

Validate:
- room name
- display name
- room type
- secret code presence for secured rooms
- message body presence
- request payload structure

Do not hard-cap message length in the UI unless needed for abuse control.
If server payload protection is added, document it clearly.

---

## UI Component Strategy
Use:
- `components/ui/` for shadcn primitives
- `features/rooms/components/` for room creation/join components
- `features/chat/components/` for chat UI

Expected reusable components:
- create-room-form
- join-room-form
- room-header
- message-list
- message-item
- message-composer
- copy-link-button
- protected-room-badge
- empty-chat-state
- loading-state

Keep components focused and composable.

---

## Preferred Folder Structure

```text
src/
  app/
    (marketing)/
      page.tsx
    create/
      page.tsx
    room/
      [slug]/
        page.tsx
        loading.tsx
        error.tsx
    api/
      rooms/
      messages/
    globals.css
    layout.tsx

  components/
    ui/

  features/
    rooms/
      actions/
      components/
      lib/
      schemas/
      types/
    chat/
      actions/
      components/
      hooks/
      lib/
      schemas/
      types/

  lib/
    supabase/
      browser.ts
      server.ts
      admin.ts
    auth/
      guest-session.ts
    security/
      hash.ts
      rate-limit.ts
      sanitize.ts
    utils/
      slug.ts
      dates.ts
      env.ts
      cn.ts

  types/
    database.ts

  supabase/
    schema.sql
    policies.sql
    seed.sql

  tests/
    unit/
    integration/
    e2e/
```

If a simpler structure makes the implementation cleaner, prefer simplicity over strict adherence.

---

## Environment Variables

Create a `.env.local` file for local development and add the following variables:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
```

### Rules
- Variables prefixed with `NEXT_PUBLIC_` are safe to expose to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` must only be used on the server.
- Never import server-only secrets into client components.
- Validate environment variables in a dedicated helper such as `lib/utils/env.ts`.
- Keep `.env.local` out of version control.

---

## Coding Standards
- Use strict TypeScript
- Prefer named helpers and descriptive function names
- Avoid giant files
- Keep server-only modules separate
- Add comments sparingly and only when useful
- Handle errors explicitly
- Return typed results where practical
- Use async/await consistently
- Keep imports organized
- Avoid duplicate logic across features

---

## Server vs Client Rules

### Server components should handle:
- room lookup
- initial room metadata fetch
- initial messages fetch if appropriate
- access gating decisions where practical

### Client components should handle:
- realtime subscriptions
- live message updates
- form interactions
- local guest session state
- copy link interactions
- auto-scroll behavior

Sensitive logic must remain server-side.

---

## Guest Session Rules
Create a guest session utility that:
- generates a stable guest ID
- stores display name locally
- retrieves existing identity on reload
- allows room rejoin without excessive friction

Do not mistake guest identity for true auth.
This is convenience state, not secure identity.

---

## Rate Limiting Guidance
Protect at minimum:
- create room endpoint/action
- secured room join attempts
- message sending

Recommended implementation:
- IP-based or session-based limiter using Upstash Redis

Handle limit errors gracefully with user-friendly messages.

---

## Error Handling Rules
Every core flow must handle:
- invalid room slug
- room not found
- wrong secret code
- failed room creation
- failed message send
- realtime connection issues
- empty message submission
- temporary backend failures

Use:
- inline form errors
- toast notifications
- route-level error UI where appropriate

---

## Accessibility Rules
- keyboard-friendly forms
- proper labels and aria attributes
- visible focus states
- sufficient color contrast
- semantic HTML for chat structure where reasonable

---

## Testing Expectations

### Unit tests
Cover:
- slug generation
- room schema validation
- secret code hashing and comparison
- guest session helpers
- message validation

### Integration tests
Cover:
- room creation flow
- secured room join validation
- message insert flow

### E2E tests
Cover:
- create open room and chat
- create secured room and join with correct code
- join secured room with wrong code
- open room link on second browser/device simulation

---

## README Expectations
The generated README must include:
- project overview
- feature list
- stack
- architecture summary
- folder structure
- local setup steps
- environment variables
- Supabase setup
- running locally
- deployment
- future improvements

---

## SQL Expectations
When generating SQL:
- include tables
- include indexes
- include foreign keys
- include optional policies if used
- include helpful comments only if they add clarity
- ensure schema matches TypeScript assumptions

---

## How Claude Should Respond When Generating Code
When asked to generate the project:
1. Start with architecture overview
2. Show final folder structure
3. Generate files one by one
4. Keep code complete and internally consistent
5. Explain each file briefly
6. Include SQL schema
7. Include `.env.example`
8. Include `README.md`
9. Prefer runnable code over pseudo-code

---

## Decision Preferences
When choosing between two approaches:
- choose the simpler approach that keeps security intact
- choose server-side validation over client-only validation
- choose maintainability over cleverness
- choose strong defaults over optional complexity
- choose readable code over heavy abstraction

---

## Specific Build Instructions
Implement:
- room slug generation with collision handling
- room creation form with open/secured selection
- secret code hashing for secured rooms
- join form with display name
- secure code validation for secured rooms
- room page with initial messages + realtime subscription
- message composer with long-form text support
- copy-link button
- responsive layout
- loading/error/empty states
- toast notifications

---

## Things to Avoid
- No full auth system in MVP
- No unnecessary websocket server separate from Supabase
- No overly complex state management
- No premature microservices split
- No client-side secret validation
- No plain-text room code storage
- No giant all-in-one files

---

## Success Criteria
The MVP is successful if:
- user creates a room in under a minute
- shared link opens correctly on another device
- open rooms join instantly
- secured rooms block unauthorized access
- messages appear in realtime
- long messages are supported
- UI feels modern and responsive
- codebase is clean enough for future auth and collaboration features
