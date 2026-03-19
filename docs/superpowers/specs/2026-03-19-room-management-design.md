# Room Management Design

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Add two features to ChatboxAI:

1. **Home screen rooms list** — display previously joined/created rooms below the hero, with Rejoin and Close actions
2. **Close room** — any member can permanently delete a room and all its messages, with realtime notification to all active participants

---

## Problem

Users hitting the rate limit (5 rooms/hour) have no way to view or clean up their existing rooms. There is also no way to end a room once it's no longer needed.

---

## Data Model

Add one column to the existing `rooms` table:

```sql
ALTER TABLE rooms ADD COLUMN closed_by_name TEXT;
```

`is_active BOOLEAN DEFAULT true` already exists. It becomes the soft-close flag.
`closed_by_name` stores the display name of whoever triggered the close — needed for the toast message broadcast to other participants.

No other schema changes. CASCADE DELETE on messages already handles cleanup when a room is deleted.

---

## Server Actions

### `close-room.ts` — `src/features/rooms/actions/close-room.ts`

- Input: `{ roomId: string, displayName: string }`
- Validates both fields are present and non-empty
- UPDATEs: `SET is_active = false, closed_by_name = displayName WHERE id = roomId AND is_active = true`
- Returns `{ success: boolean, error?: string }`
- The `AND is_active = true` guard makes concurrent closes a safe no-op

### `cleanup-closed-rooms.ts` — `src/features/rooms/actions/cleanup-closed-rooms.ts`

- Input: `slugs: string[]` (read from guest localStorage on home page mount)
- DELETEs rooms WHERE `slug = ANY(slugs) AND is_active = false`
- CASCADE removes all messages for deleted rooms
- Also called after a close-room redirect lands on home page
- Returns `{ deleted: number }`

---

## Home Screen Rooms List

### Layout

Section titled **"Your Rooms"** appears below the existing hero/join form on `/`. Only shown when the guest has at least one joined room in localStorage.

Each row displays:
- Icon (💬 for Open, 🔒 for Secured)
- Room name (bold)
- Type badge (green "Open" / orange "Secured")
- Relative time joined (e.g. "Joined 2h ago")
- **Rejoin** button → navigates to `/room/[slug]`
- **Close** button → confirmation dialog → close-room action

### Data Flow

1. On mount, read `joinedRooms` array from localStorage (already tracked by guest session)
2. Call a server action (or route handler) with the slug list to fetch current room status: `{ slug, name, room_type, is_active }`
3. Filter out slugs that returned `is_active = false` or not found — remove them from localStorage
4. Render remaining active rooms in the list
5. On home page mount, also call `cleanup-closed-rooms` with all stored slugs to purge stale data

### New component

`src/features/rooms/components/your-rooms-list.tsx` — client component responsible for:
- Reading localStorage on mount
- Fetching room statuses
- Rendering the list
- Handling Rejoin navigation and Close confirmation

### New server action / query

`src/features/rooms/actions/get-rooms-by-slugs.ts` — accepts `slugs: string[]`, returns public room fields (`id`, `slug`, `name`, `room_type`, `is_active`). Never returns `secret_code_hash` or `closed_by_name`.

---

## Room Page Changes

### Close Room Button

Added to the existing room header (Option A — visible button, not behind a menu):

```
[← Back]  [room name]  [Copy link]  [Close room]
```

- Styled with red text, subtle dark background
- Clicking shows a confirmation dialog: *"This will permanently delete the room and all messages. This cannot be undone."*
- On confirm: calls `close-room` action with `roomId` and guest's `displayName`
- The closing client waits for the realtime event like all others (no special redirect logic on the caller side)

### Rooms Table Realtime Subscription

Extended in `src/features/chat/hooks/use-realtime-messages.ts` (or a new `use-room-status.ts` hook):

- Subscribes to `postgres_changes` `UPDATE` on `rooms` table filtered by `id = eq.{roomId}`
- When `is_active = false` is detected:
  1. Show Sonner toast: *"This room was closed by {closed_by_name}"* (duration: 4s)
  2. After 2 seconds, `router.push('/')`

### Room Page Load Guard

The server component for `/room/[slug]` already fetches the room. Add check:
- If `room.is_active === false` → redirect to `/` with searchParam `?closed=1`
- Home page reads `?closed=1` and shows toast: *"That room no longer exists"*

---

## Error Handling

| Scenario | Handling |
|---|---|
| Two users close simultaneously | `AND is_active = true` guard; second call is a no-op; realtime fires once |
| Slug not found in DB | Silently removed from localStorage on home screen fetch |
| Close from home screen | Same `close-room` action; uses guest `displayName` from localStorage |
| Room already closed when page loads | Server redirect to `/` with `?closed=1` |
| Realtime subscription drops | Next send-message action fails; user retries or refreshes and discovers room is gone |
| Close action network failure | Toast error: *"Failed to close room. Please try again."* |

---

## Components Affected

| File | Change |
|---|---|
| `src/app/page.tsx` | Add `<YourRoomsList />`, read `?closed=1` param for toast |
| `src/features/rooms/components/your-rooms-list.tsx` | **New** — home screen rooms list |
| `src/features/rooms/actions/get-rooms-by-slugs.ts` | **New** — fetch room statuses by slug list |
| `src/features/rooms/actions/close-room.ts` | **New** — soft-close a room |
| `src/features/rooms/actions/cleanup-closed-rooms.ts` | **New** — delete soft-closed rooms |
| `src/features/chat/components/chat-room.tsx` | Add Close Room button to header |
| `src/features/chat/hooks/use-realtime-messages.ts` | Add rooms table UPDATE subscription |
| `src/app/room/[slug]/page.tsx` | Add `is_active` guard with redirect |
| `supabase/schema.sql` | Add `closed_by_name TEXT` column |

---

## Out of Scope

- Rate limit increase (close-room gives users the ability to free up their slot organically)
- Participant count on room rows (requires participants table query; post-MVP)
- Undo / room restore
- Admin controls
