# Room Management Design

**Date:** 2026-03-19
**Status:** Revised (v4)

---

## Overview

Add two features to ChatboxAI:

1. **Home screen rooms list** — display previously joined/created rooms below the hero, with Rejoin and Close actions
2. **Close room** — any member currently in the room can permanently delete a room and all its messages, with realtime notification broadcast to all active participants

---

## Problem

Users hitting the rate limit (5 rooms/hour) have no way to view or clean up their existing rooms. There is also no way to end a room once it's no longer needed.

---

## Authorization Note (MVP Tradeoff)

Guest identity (localStorage) cannot be verified server-side. The `close-room` action accepts any request with a valid `roomId` (UUID). This is an accepted MVP tradeoff:
- `roomId` is a UUID not exposed in the URL (slug is used in URLs)
- Anyone determined to disrupt a room they're in could already do so via messages
- "Anyone in the room" as the intended closer aligns with the guest-first, trust-light architecture

This tradeoff must be revisited when real authentication is added post-MVP.

---

## Data Model

Update `supabase/schema.sql` — modify the `CREATE TABLE rooms` block directly (do not use a separate `ALTER TABLE` migration; this project uses a single idempotent DDL file):

```sql
-- Add to CREATE TABLE rooms:
closed_by_name TEXT
```

Also add after the table definition:
```sql
ALTER TABLE rooms REPLICA IDENTITY FULL;
```

This is required for Supabase Realtime `postgres_changes` UPDATE events to include `payload.new` with all columns (including `closed_by_name`).

**Important — live database migration:** `REPLICA IDENTITY FULL` only affects replication going forward. Rooms created before this ALTER runs will have UPDATE payloads with `payload.new` missing unchanged columns. This ALTER must be run as a one-time statement directly on the live Supabase database (via the SQL editor or migration tool), not only added to `schema.sql` (which only applies to fresh installs). Run it before deploying the feature.

`is_active BOOLEAN DEFAULT true` already exists. It is used as a **short-lived soft-close flag**: the `close-room` action sets it to `false` to trigger the realtime event, then immediately hard-deletes the row. The `is_active = false` state is transient (milliseconds to seconds). If the hard-delete fails after the UPDATE succeeds, the room remains with `is_active = false` as a dangling soft-close. This is an acceptable edge case — the room is already effectively closed for all clients (they were redirected) and will not appear in `get-rooms-by-slugs` results. No transaction is needed between the UPDATE and DELETE steps.

Update `src/types/database.ts` — add `closed_by_name: string | null` to the `rooms` table `Row`, `Insert`, and `Update` types.

---

## `guest-session.ts` Updates

The existing storage key `chatboxai_joined_rooms` currently stores a `Record<string, boolean>` (keyed by `roomId`). This format must be replaced.

**New type:**
```ts
type JoinedRoom = {
  slug: string
  name: string
  room_type: 'open' | 'secured'
  joinedAt: string // ISO timestamp
}
```

**Migration strategy — data loss tradeoff:** The old format (`Record<string,boolean>` keyed by `roomId`) is incompatible with the new array format. On read, if the stored value is not a `JoinedRoom[]`, the key is cleared and `[]` is returned. **This means existing users lose their room history on first load after deployment.** This is an accepted MVP tradeoff — guest room history is convenience data, not critical state. If this is unacceptable, implement a one-time migration that reads the old UUIDs, fetches room slugs from the DB, and writes the new format. For this spec, the simple clear-and-reset approach is used.

Parse defensively:
```ts
function getJoinedRooms(): JoinedRoom[] {
  const raw = localStorage.getItem('chatboxai_joined_rooms')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      localStorage.removeItem('chatboxai_joined_rooms')
      return []
    }
    return parsed as JoinedRoom[]
  } catch {
    localStorage.removeItem('chatboxai_joined_rooms')
    return []
  }
}
```

**New/updated functions to expose:**
- `getJoinedRooms(): JoinedRoom[]`
- `addJoinedRoom(room: JoinedRoom): void` — appends or updates by slug
- `removeJoinedRoom(slug: string): void` — removes by slug
- `hasJoinedRoom(slug: string): boolean` — replaces the old `hasJoinedRoom(roomId)` — looks up by slug

**Call site update:** `chat-room.tsx` currently calls `markRoomJoined(roomId)` and `hasJoinedRoom(roomId)`. Replace with:
- `addJoinedRoom({ slug: room.slug, name: room.name, room_type: room.room_type, joinedAt: new Date().toISOString() })` — called in the `handleJoined` callback (the `RoomPublic` prop is available at that point)
- `hasJoinedRoom(room.slug)` — for the secured room join gate

---

## Server Actions

### `close-room.ts` — `src/features/rooms/actions/close-room.ts`

**Zod schema:**
```ts
const closeRoomSchema = z.object({
  roomId: z.string().uuid(),
  displayName: z.string().min(1).max(50),
})
```

**Logic:**
1. Validate input with `closeRoomSchema`
2. UPDATE: `SET is_active = false, closed_by_name = displayName WHERE id = roomId AND is_active = true`
   - Uses Supabase admin client (service role)
   - `AND is_active = true` makes concurrent closes a safe no-op (second caller gets "not found")
3. Check `count` of updated rows. If 0, return `{ success: false, error: 'Room not found or already closed' }`
4. Immediately DELETE room WHERE `id = roomId` (CASCADE removes all messages)
5. Return `{ success: true }` (or `{ success: false, error }` on DELETE failure — dangling soft-close acceptable, see Data Model section)

The UPDATE fires the Supabase Realtime event to all subscribers. The DELETE then removes the row. The two operations are not wrapped in a transaction.

### `get-rooms-by-slugs.ts` — `src/features/rooms/actions/get-rooms-by-slugs.ts`

**Zod schema:**
```ts
const getRoomsBySlugsSchema = z.object({
  slugs: z.array(z.string()).max(20),
})
```

**Logic:**
1. Validate input
2. SELECT `id, slug, name, room_type, is_active` WHERE `slug = ANY(slugs) AND is_active = true`
   - Filter `is_active = true` server-side. Inactive rooms are hard-deleted immediately after soft-close, so this is largely a safety filter.
3. Never return `secret_code_hash` or `closed_by_name`
4. Return `{ rooms: RoomStatus[] }`

**Client-side cleanup:** Any slug from localStorage not present in the returned `rooms` array (either deleted, never existed, or in the transient soft-closed state) is removed from localStorage via `removeJoinedRoom(slug)`.

---

## Room Page Load Guard

Update `getRoomBySlug` (wherever it lives — `src/features/rooms/lib/queries.ts` or equivalent) to remove the `.eq('is_active', true)` filter so both active and soft-closed rooms can be fetched.

In the server component (`src/app/room/[slug]/page.tsx`):
```ts
if (!room) {
  notFound() // slug never existed
}
if (!room.is_active) {
  redirect('/?closed=1') // room was soft-closed (transient state)
}
```

`generateMetadata` also calls `getRoomBySlug`. After this change, a soft-closed room will return valid room data to `generateMetadata` — this is acceptable since the page will redirect before rendering.

The home page reads `?closed=1` searchParam on mount and shows a Sonner toast: *"That room no longer exists."*

---

## Home Screen Rooms List

### States

- **Hidden entirely** when `getJoinedRooms()` returns `[]` (first-time users see no section)
- **Loading**: skeleton rows (same height as room rows) while `get-rooms-by-slugs` is in-flight
- **Error**: inline message — *"Could not load your rooms."* — with a Retry button
- **Populated**: list of active room rows

### Data Flow

1. On mount, call `getJoinedRooms()` from localStorage
2. If empty array, render nothing (section hidden)
3. Call `get-rooms-by-slugs` with all slugs (max 20)
4. For each slug in localStorage not present in the returned rooms, call `removeJoinedRoom(slug)`
5. Render rooms returned by the query (all `is_active = true` since filtered server-side)
6. Read `?closed=1` from URL on mount → show toast *"That room no longer exists."* → strip param from URL via `router.replace('/')`

### Row Layout

```
[icon] [room name]          [type badge] [Joined X ago]    [Rejoin] [Close]
```

- Icon: 💬 for Open, 🔒 for Secured
- Type badge: green "Open" / orange "Secured"
- Rejoin → `router.push('/room/[slug]')`
- Close → open `AlertDialog` confirmation

### Confirmation Dialog (shadcn `AlertDialog`)

```
Title: "Close this room?"
Body:  "This will permanently delete the room and all its messages.
        Everyone will be removed. This cannot be undone."
Actions: [Cancel]  [Close room]
```

On confirm: call `close-room` with `roomId` and `getDisplayName()` (the existing function in `guest-session.ts`). The `roomId` (UUID) passed to `close-room` must come from the `get-rooms-by-slugs` response — it is **not** stored in the `JoinedRoom` localStorage object (which only stores `slug`, `name`, `room_type`, `joinedAt`). The `YourRoomsList` component holds the fetched `RoomStatus[]` in state after calling `get-rooms-by-slugs`, and reads `room.id` from that state when the Close button is clicked. Remove the room from the list optimistically on success.

### New Files

- `src/features/rooms/components/your-rooms-list.tsx` — client component
- `src/features/rooms/actions/get-rooms-by-slugs.ts`
- `src/features/rooms/actions/close-room.ts`

---

## Room Page Changes

### Close Room Button

Added to the room header in `chat-room.tsx`:

```
[← Back]  [room name]  [Copy link]  [Close room]
```

- Styled: `text-red-400`, subtle dark background, visible (not behind a menu)
- Clicking opens `AlertDialog` with same copy as home screen close dialog
- On confirm:
  1. Set a local `isClosingRef = true` (React ref, not state — to avoid re-render)
  2. Call `close-room` action with `roomId` and `displayName`
  3. Button shows loading/disabled state during the call
- On failure: show toast *"Failed to close room. Please try again."*; re-enable button; set `isClosingRef.current = false`
- **On success from the server action:** call `router.push('/')` immediately — do not wait for the realtime echo. The realtime UPDATE handler's `else` branch (`isClosingRef.current === true`) serves as a fallback only (e.g., if the action returns before realtime fires). Navigation is driven by the action return, not the realtime event, for the closer.

### Realtime Subscription — Suppressing the Closer's Own Toast

The `close-room` action sets `is_active = false`, which fires the realtime UPDATE to **all** subscribers including the person who clicked Close. Without special handling, the closer would see *"This room was closed by [their own name]"* and be redirected after 2 seconds — confusing.

**Fix:** Use the `isClosingRef` set in step 1 above. In the realtime handler:
```ts
if (payload.new.is_active === false) {
  if (!isClosingRef.current) {
    toast.error(`This room was closed by ${payload.new.closed_by_name}`, { duration: 4000 })
    setTimeout(() => router.push('/'), 2000)
  } else {
    // Closer: redirect immediately, no toast
    router.push('/')
  }
}
```

### Rooms Table Realtime Subscription

Chain a second `.on()` call to the **existing named channel** `room:${roomId}` in `use-realtime-messages.ts`. Do not create a separate channel — this avoids subscription leaks since the existing `removeChannel` cleanup handles both listeners.

```ts
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'rooms',
  filter: `id=eq.${roomId}`,
}, (payload) => {
  const room = payload.new as Pick<Room, 'is_active' | 'closed_by_name'>
  if (room.is_active === false) {
    if (!isClosingRef.current) {
      toast.error(`This room was closed by ${room.closed_by_name}`, { duration: 4000 })
      setTimeout(() => router.push('/'), 2000)
    } else {
      router.push('/')
    }
  }
})
```

The `isClosingRef` must be passed into (or defined within) the hook. Choose whichever approach fits the existing hook signature — either add a `closingRef` parameter or lift the state to the parent component that calls the hook.

`Room` type here refers to the updated `src/types/database.ts` row type which includes `is_active` and `closed_by_name`.

---

## Error Handling

| Scenario | Handling |
|---|---|
| Two users close simultaneously | `AND is_active = true` guard; second call returns error silently |
| Slug not found in `get-rooms-by-slugs` | Removed from localStorage via `removeJoinedRoom` |
| Close from home screen | Same `close-room` action; `displayName` from `getDisplayName()` |
| Room already soft-closed when page loads | `getRoomBySlug` returns `is_active=false` → server redirect to `/?closed=1` |
| Realtime subscription drops | Next `send-message` action fails; user retries or refreshes and gets redirected |
| Close action network failure | Toast: *"Failed to close room. Please try again."* |
| `get-rooms-by-slugs` fetch fails | Inline error with Retry button in `YourRoomsList` |
| localStorage format mismatch (old format) | Defensive parse returns `[]`; old key cleared |
| DELETE fails after UPDATE succeeds | Room stays in dangling `is_active = false` state; all clients already redirected; acceptable |
| `generateMetadata` on closed room | Returns valid metadata; page redirect fires before render |

---

## Files Affected

| File | Change |
|---|---|
| `src/app/page.tsx` | Add `<YourRoomsList />`, read `?closed=1` searchParam |
| `src/features/rooms/components/your-rooms-list.tsx` | **New** — home screen rooms list with all states |
| `src/features/rooms/actions/get-rooms-by-slugs.ts` | **New** |
| `src/features/rooms/actions/close-room.ts` | **New** |
| `src/lib/auth/guest-session.ts` | Replace `JoinedRoom` storage format; add `getJoinedRooms`, `addJoinedRoom`, `removeJoinedRoom`, update `hasJoinedRoom` to use slug |
| `src/features/chat/components/chat-room.tsx` | Replace `markRoomJoined`/`hasJoinedRoom` call sites; add Close button + `AlertDialog`; add `isClosingRef` |
| `src/features/chat/hooks/use-realtime-messages.ts` | Chain rooms UPDATE subscription on existing channel; accept/use `isClosingRef` |
| `src/features/rooms/lib/queries.ts` (or equivalent) | Update `getRoomBySlug` to remove `is_active = true` filter |
| `src/app/room/[slug]/page.tsx` | Add `is_active` guard with `redirect('/?closed=1')` |
| `src/types/database.ts` | Add `closed_by_name: string \| null` to rooms Row/Insert/Update types |
| `supabase/schema.sql` | Add `closed_by_name TEXT` to `CREATE TABLE rooms`; add `ALTER TABLE rooms REPLICA IDENTITY FULL` |

---

## Out of Scope

- Rate limit increase (close-room gives users the ability to free up their slot organically)
- Participant count on room rows (requires participants table query; post-MVP)
- Undo / room restore
- Admin controls
- Server-verified room membership (requires auth; guest system cannot enforce this)
