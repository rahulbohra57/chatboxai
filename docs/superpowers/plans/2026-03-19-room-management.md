# Room Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Your Rooms" list to the home page and a "Close room" button that permanently deletes a room and notifies all active members via Supabase Realtime.

**Architecture:** The close-room server action soft-closes a room (`is_active = false`, `closed_by_name = X`) to trigger a Supabase Realtime UPDATE event to all subscribers, then immediately hard-deletes it (CASCADE removes messages). The home page reads joined rooms from localStorage and fetches their live status from a `get-rooms-by-slugs` server action. The `use-realtime-messages` hook gains a second subscription on the existing channel for room UPDATE events.

**Tech Stack:** Next.js 15 App Router, Supabase JS v2, TypeScript, Zod, shadcn/ui (`AlertDialog`), Sonner toasts, Vitest, Tailwind CSS

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/schema.sql` | Modify | Add `closed_by_name TEXT` column; add `REPLICA IDENTITY FULL` |
| `src/types/database.ts` | Modify | Add `closed_by_name` to rooms Row/Insert/Update |
| `src/lib/auth/guest-session.ts` | Modify | Replace `Record<string,boolean>` join tracking with `JoinedRoom[]`; update helpers |
| `tests/unit/guest-session.test.ts` | Modify | Add tests for new join-tracking functions |
| `src/features/rooms/actions/close-room.ts` | Create | Server action: soft-close then hard-delete a room |
| `src/features/rooms/actions/get-rooms-by-slugs.ts` | Create | Server action: fetch room statuses by slug list |
| `src/features/rooms/lib/room-queries.ts` | Modify | Remove `is_active = true` filter from `getRoomBySlug` |
| `src/app/room/[slug]/page.tsx` | Modify | Add `is_active` guard → redirect `/?closed=1` |
| `src/features/chat/hooks/use-realtime-messages.ts` | Modify | Chain rooms UPDATE subscription; accept `isClosingRef` |
| `src/features/chat/components/chat-room.tsx` | Modify | Add Close Room button + AlertDialog; update join tracking call sites |
| `src/features/rooms/components/your-rooms-list.tsx` | Create | Client component: home screen rooms list with all states |
| `src/app/page.tsx` | Modify | Add `<YourRoomsList />`; handle `?closed=1` toast |

---

## Task 1: Schema and TypeScript Types

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add `closed_by_name` to schema.sql**

  Open `supabase/schema.sql`. In the `create table if not exists rooms` block, add `closed_by_name TEXT` after the `is_active` line:

  ```sql
  create table if not exists rooms (
    id                  uuid primary key default gen_random_uuid(),
    slug                text unique not null,
    name                text not null,
    room_type           text not null check (room_type in ('open', 'secured')),
    secret_code_hash    text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    created_by_guest_id text,
    is_active           boolean not null default true,
    closed_by_name      text
  );
  ```

  Also add after the `rooms_is_active_idx` line:

  ```sql
  alter table rooms replica identity full;
  ```

- [ ] **Step 2: Run the REPLICA IDENTITY statement on the live DB**

  Go to your Supabase project → SQL Editor and run:
  ```sql
  ALTER TABLE rooms ADD COLUMN IF NOT EXISTS closed_by_name TEXT;
  ALTER TABLE rooms REPLICA IDENTITY FULL;
  ```
  This must be run on the live database — the schema.sql only applies to fresh installs.

- [ ] **Step 3: Update `src/types/database.ts` — rooms Row**

  Find the `rooms` `Row` type and add `closed_by_name`:
  ```ts
  Row: {
    id: string
    slug: string
    name: string
    room_type: 'open' | 'secured'
    secret_code_hash: string | null
    closed_by_name: string | null   // ← add this
    created_at: string
    updated_at: string
    created_by_guest_id: string | null
    is_active: boolean
  }
  ```

  Find the `rooms` `Insert` type and add:
  ```ts
  closed_by_name?: string | null   // ← add this (optional)
  ```

  The `Update` type is `Partial<Insert>` so it picks up the change automatically.

  > Note: `RoomPublic` is defined as `Omit<Room, 'secret_code_hash'>` in `src/features/rooms/types/room.types.ts` — it will automatically include `closed_by_name`. No change needed there.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/schema.sql src/types/database.ts
  git commit -m "feat: add closed_by_name column to rooms schema and types"
  ```

---

## Task 2: Update `guest-session.ts` — JoinedRoom Storage

**Files:**
- Modify: `src/lib/auth/guest-session.ts`
- Modify: `tests/unit/guest-session.test.ts`

The existing `chatboxai_joined_rooms` key stores `Record<string,boolean>` keyed by `roomId`. We replace it with `JoinedRoom[]` keyed by `slug`, with a defensive migration.

- [ ] **Step 1: Write failing tests**

  Add to `tests/unit/guest-session.test.ts`:

  ```ts
  import {
    getOrCreateGuestId,
    getDisplayName,
    setDisplayName,
    clearDisplayName,
    getGuestIdentity,
    getJoinedRooms,
    addJoinedRoom,
    removeJoinedRoom,
    hasJoinedRoom,
  } from '@/lib/auth/guest-session'

  // Add these new describe blocks after the existing ones:

  describe('joined rooms', () => {
    it('returns empty array when nothing stored', () => {
      expect(getJoinedRooms()).toEqual([])
    })

    it('adds a room and retrieves it', () => {
      addJoinedRoom({ slug: 'my-room', name: 'My Room', room_type: 'open', joinedAt: '2026-01-01T00:00:00.000Z' })
      const rooms = getJoinedRooms()
      expect(rooms).toHaveLength(1)
      expect(rooms[0].slug).toBe('my-room')
      expect(rooms[0].name).toBe('My Room')
    })

    it('addJoinedRoom updates existing room by slug', () => {
      addJoinedRoom({ slug: 'my-room', name: 'Old Name', room_type: 'open', joinedAt: '2026-01-01T00:00:00.000Z' })
      addJoinedRoom({ slug: 'my-room', name: 'New Name', room_type: 'open', joinedAt: '2026-01-02T00:00:00.000Z' })
      expect(getJoinedRooms()).toHaveLength(1)
      expect(getJoinedRooms()[0].name).toBe('New Name')
    })

    it('removeJoinedRoom removes by slug', () => {
      addJoinedRoom({ slug: 'my-room', name: 'My Room', room_type: 'open', joinedAt: '2026-01-01T00:00:00.000Z' })
      addJoinedRoom({ slug: 'other-room', name: 'Other', room_type: 'secured', joinedAt: '2026-01-01T00:00:00.000Z' })
      removeJoinedRoom('my-room')
      const rooms = getJoinedRooms()
      expect(rooms).toHaveLength(1)
      expect(rooms[0].slug).toBe('other-room')
    })

    it('hasJoinedRoom returns true for stored slug', () => {
      addJoinedRoom({ slug: 'my-room', name: 'My Room', room_type: 'open', joinedAt: '2026-01-01T00:00:00.000Z' })
      expect(hasJoinedRoom('my-room')).toBe(true)
    })

    it('hasJoinedRoom returns false for unknown slug', () => {
      expect(hasJoinedRoom('unknown')).toBe(false)
    })

    it('getJoinedRooms clears and returns [] when old Record format is found', () => {
      // Simulate old format: { "some-uuid": true }
      localStorage.setItem('chatboxai_joined_rooms', JSON.stringify({ 'some-uuid': true }))
      expect(getJoinedRooms()).toEqual([])
      // Key should be cleared
      expect(localStorage.getItem('chatboxai_joined_rooms')).toBeNull()
    })

    it('getJoinedRooms returns [] on malformed JSON', () => {
      localStorage.setItem('chatboxai_joined_rooms', 'not-json')
      expect(getJoinedRooms()).toEqual([])
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd /Users/chetan/Desktop/DSE_Projects/ChatboxAI
  pnpm vitest run tests/unit/guest-session.test.ts
  ```

  Expected: failures on `getJoinedRooms`, `addJoinedRoom`, `removeJoinedRoom`, `hasJoinedRoom` (not exported yet).

- [ ] **Step 3: Implement the new functions in `guest-session.ts`**

  Replace the existing `hasJoinedRoom` and `markRoomJoined` functions with the following. Keep all other existing functions unchanged.

  ```ts
  export type JoinedRoom = {
    slug: string
    name: string
    room_type: 'open' | 'secured'
    joinedAt: string // ISO timestamp
  }

  export function getJoinedRooms(): JoinedRoom[] {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(JOINED_ROOMS_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(JOINED_ROOMS_KEY)
        return []
      }
      return parsed as JoinedRoom[]
    } catch {
      localStorage.removeItem(JOINED_ROOMS_KEY)
      return []
    }
  }

  export function addJoinedRoom(room: JoinedRoom): void {
    if (typeof window === 'undefined') return
    const rooms = getJoinedRooms()
    const existing = rooms.findIndex((r) => r.slug === room.slug)
    if (existing >= 0) {
      rooms[existing] = room
    } else {
      rooms.push(room)
    }
    localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(rooms))
  }

  export function removeJoinedRoom(slug: string): void {
    if (typeof window === 'undefined') return
    const rooms = getJoinedRooms().filter((r) => r.slug !== slug)
    localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(rooms))
  }

  export function hasJoinedRoom(slug: string): boolean {
    if (typeof window === 'undefined') return false
    return getJoinedRooms().some((r) => r.slug === slug)
  }
  ```

  Also **delete** the old `markRoomJoined` function entirely (it will be replaced by `addJoinedRoom` at the call site in Task 6).

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  pnpm vitest run tests/unit/guest-session.test.ts
  ```

  Expected: all tests pass, including the existing ones.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/auth/guest-session.ts tests/unit/guest-session.test.ts
  git commit -m "feat: replace joined rooms storage with JoinedRoom[] array format"
  ```

---

## Task 3: Create `close-room` Server Action

**Files:**
- Create: `src/features/rooms/actions/close-room.ts`

- [ ] **Step 1: Create the file**

  ```ts
  'use server'

  import { z } from 'zod'
  import { getSupabaseAdminClient } from '@/lib/supabase/admin'

  const closeRoomSchema = z.object({
    roomId: z.string().uuid(),
    displayName: z.string().min(1).max(50),
  })

  export type CloseRoomResult =
    | { success: true }
    | { success: false; error: string }

  export async function closeRoom(
    roomId: string,
    displayName: string
  ): Promise<CloseRoomResult> {
    const parsed = closeRoomSchema.safeParse({ roomId, displayName })
    if (!parsed.success) {
      return { success: false, error: 'Invalid input.' }
    }

    const supabase = getSupabaseAdminClient()

    // Soft-close: triggers Supabase Realtime UPDATE event to all room subscribers.
    // Chain .select('id') so we can check if a row was actually updated
    // (Supabase JS v2 does not return a count from .update() without .select()).
    const { data: updated, error: updateError } = await supabase
      .from('rooms')
      .update({ is_active: false, closed_by_name: displayName })
      .eq('id', roomId)
      .eq('is_active', true)
      .select('id')

    if (updateError) {
      console.error('[close-room] update error:', updateError)
      return { success: false, error: 'Failed to close room.' }
    }

    if (!updated || updated.length === 0) {
      // Room not found or already closed — safe no-op
      return { success: false, error: 'Room not found or already closed.' }
    }

    // Hard-delete: CASCADE removes all messages
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)

    if (deleteError) {
      // Dangling soft-close: room is already effectively closed (clients redirected by realtime).
      // Not a user-facing error — log and return success since the close already propagated.
      console.error('[close-room] delete error (dangling soft-close):', deleteError)
    }

    return { success: true }
  }
  ```

- [ ] **Step 2: Manual smoke test**

  With the dev server running (`pnpm dev`), open a room and trigger close from the browser console temporarily (you'll wire the UI in Task 6). Or proceed to Task 4 and test end-to-end after the UI is wired.

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/rooms/actions/close-room.ts
  git commit -m "feat: add close-room server action (soft-close + hard-delete)"
  ```

---

## Task 4: Create `get-rooms-by-slugs` Server Action

**Files:**
- Create: `src/features/rooms/actions/get-rooms-by-slugs.ts`

- [ ] **Step 1: Create the file**

  ```ts
  'use server'

  import { z } from 'zod'
  import { getSupabaseAdminClient } from '@/lib/supabase/admin'

  const getRoomsBySlugsSchema = z.object({
    slugs: z.array(z.string()).max(20),
  })

  export type RoomStatus = {
    id: string
    slug: string
    name: string
    room_type: 'open' | 'secured'
    is_active: boolean
  }

  export type GetRoomsBySlugsResult =
    | { success: true; rooms: RoomStatus[] }
    | { success: false; error: string }

  export async function getRoomsBySlugs(
    slugs: string[]
  ): Promise<GetRoomsBySlugsResult> {
    const parsed = getRoomsBySlugsSchema.safeParse({ slugs })
    if (!parsed.success) {
      return { success: false, error: 'Invalid input.' }
    }

    if (slugs.length === 0) {
      return { success: true, rooms: [] }
    }

    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('rooms')
      .select('id, slug, name, room_type, is_active')
      .in('slug', slugs)
      .eq('is_active', true)

    if (error) {
      console.error('[get-rooms-by-slugs] error:', error)
      return { success: false, error: 'Failed to fetch rooms.' }
    }

    return { success: true, rooms: data as RoomStatus[] }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/features/rooms/actions/get-rooms-by-slugs.ts
  git commit -m "feat: add get-rooms-by-slugs server action"
  ```

---

## Task 5: Update Room Queries and Room Page Guard

**Files:**
- Modify: `src/features/rooms/lib/room-queries.ts`
- Modify: `src/app/room/[slug]/page.tsx`

- [ ] **Step 1: Remove `is_active` filter from `getRoomBySlug`**

  In `src/features/rooms/lib/room-queries.ts`, find `getRoomBySlug` and remove `.eq('is_active', true)`.

  > `getRoomForValidation` in the same file also has `.eq('is_active', true)`. Leave it unchanged — it is only used during the join flow, which has a millisecond-wide edge case if a room is mid-close. This is acceptable for MVP.


  ```ts
  export async function getRoomBySlug(
    slug: string,
    supabase: SupabaseClient<Database>
  ): Promise<RoomPublic | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, slug, name, room_type, created_at, updated_at, created_by_guest_id, is_active, closed_by_name')
      .eq('slug', slug)
      .maybeSingle()   // ← removed .eq('is_active', true)

    if (error) {
      console.error('[room-queries] getRoomBySlug error:', error)
      return null
    }
    return data
  }
  ```

  > Also add `closed_by_name` to the select string so the field is available on `RoomPublic`.

- [ ] **Step 2: Add `is_active` guard to the room page**

  In `src/app/room/[slug]/page.tsx`, add the redirect import and guard:

  ```ts
  import { notFound, redirect } from 'next/navigation'
  import { getSupabaseServerClient } from '@/lib/supabase/server'
  import { getRoomBySlug } from '@/features/rooms/lib/room-queries'
  import { getMessagesByRoom } from '@/features/chat/lib/message-queries'
  import { ChatRoom } from '@/features/chat/components/chat-room'

  interface RoomPageProps {
    params: Promise<{ slug: string }>
  }

  export default async function RoomPage({ params }: RoomPageProps) {
    const { slug } = await params
    const supabase = await getSupabaseServerClient()

    const room = await getRoomBySlug(slug, supabase)
    if (!room) notFound()
    if (!room.is_active) redirect('/?closed=1')   // ← add this

    const messages = await getMessagesByRoom(room.id, supabase)

    return (
      <main className="flex flex-col h-screen bg-background">
        <ChatRoom room={room} initialMessages={messages} />
      </main>
    )
  }

  export async function generateMetadata({ params }: RoomPageProps) {
    const { slug } = await params
    const supabase = await getSupabaseServerClient()
    const room = await getRoomBySlug(slug, supabase)
    return {
      title: room ? `${room.name} — ChatboxAI` : 'Room not found — ChatboxAI',
    }
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  pnpm tsc --noEmit
  ```

  Expected: no errors. If `RoomPublic` errors on `closed_by_name`, ensure `database.ts` was updated in Task 1.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/rooms/lib/room-queries.ts src/app/room/[slug]/page.tsx
  git commit -m "feat: update room queries and page guard for soft-close detection"
  ```

---

## Task 6: Update `use-realtime-messages` Hook

**Files:**
- Modify: `src/features/chat/hooks/use-realtime-messages.ts`

The hook gains a `isClosingRef` parameter and a second `.on()` listener on the existing channel for room UPDATE events.

- [ ] **Step 1: Update the hook signature and subscription**

  Replace the full `useRealtimeMessages` function with:

  ```ts
  'use client'

  import { useCallback, useEffect, useRef, useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { toast } from 'sonner'
  import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
  import type { Message } from '../types/message.types'
  import type { RoomPublic } from '@/features/rooms/types/room.types'

  export function useRealtimeMessages(
    roomId: string,
    initialMessages: Message[],
    isClosingRef: React.MutableRefObject<boolean>   // ← new parameter
  ): {
    messages: Message[]
    addMessage: (msg: Message) => void
    addOptimistic: (tempId: string, msg: Message) => void
    confirmOptimistic: (tempId: string, realMessage: Message) => void
  } {
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)))
    const lastSeenAt = useRef<string>(
      initialMessages.at(-1)?.created_at ?? new Date(0).toISOString()
    )

    // Keep addMessage, addOptimistic, confirmOptimistic function bodies exactly
    // as they appear in the existing file — do not modify them.

    // Realtime subscription
    useEffect(() => {
      const supabase = getSupabaseBrowserClient()

      const channel = supabase
        .channel(`room:${roomId}`)
        // Existing: listen for new messages
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const newMessage = payload.new as Message
            if (!seenIds.current.has(newMessage.id)) {
              seenIds.current.add(newMessage.id)
              if (newMessage.created_at > lastSeenAt.current) {
                lastSeenAt.current = newMessage.created_at
              }
              setMessages((prev) => [...prev, newMessage])
            }
          }
        )
        // New: listen for room soft-close
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            const updated = payload.new as Pick<RoomPublic, 'is_active' | 'closed_by_name'>
            if (updated.is_active === false) {
              if (!isClosingRef.current) {
                // Another user closed the room
                toast.error(
                  `This room was closed by ${updated.closed_by_name ?? 'someone'}`,
                  { duration: 4000 }
                )
                setTimeout(() => router.push('/'), 2000)
              }
              // If isClosingRef.current === true, the closer already navigates
              // immediately after the server action returns (in chat-room.tsx).
              // No action needed here for the closer.
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }, [roomId, isClosingRef, router])

    // Keep the polling fallback useEffect (setInterval every 2s) exactly as
    // it appears in the existing file — do not modify it.

    return { messages, addMessage, addOptimistic, confirmOptimistic }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  pnpm tsc --noEmit
  ```

  Expected: no errors. `chat-room.tsx` will show an error until updated in Task 7 (wrong number of args to the hook). That's fine — fix it in the next task.

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/chat/hooks/use-realtime-messages.ts
  git commit -m "feat: add room soft-close realtime subscription to useRealtimeMessages"
  ```

---

## Task 7: Update `chat-room.tsx` — Close Button + Join Tracking

**Files:**
- Modify: `src/features/chat/components/chat-room.tsx`

- [ ] **Step 1: Full updated file**

  Replace `src/features/chat/components/chat-room.tsx` with:

  ```tsx
  'use client'

  import { useEffect, useRef, useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { toast } from 'sonner'
  import { useRealtimeMessages } from '../hooks/use-realtime-messages'
  import { MessageList } from './message-list'
  import { MessageComposer } from './message-composer'
  import { JoinRoomForm } from '@/features/rooms/components/join-room-form'
  import { RoomHeader } from '@/features/rooms/components/room-header'
  import {
    getOrCreateGuestId,
    getDisplayName,
    hasJoinedRoom,
    addJoinedRoom,
  } from '@/lib/auth/guest-session'
  import { closeRoom } from '@/features/rooms/actions/close-room'
  import { getAIResponse } from '../actions/ai-response'
  import type { Message } from '../types/message.types'
  import type { RoomPublic } from '@/features/rooms/types/room.types'

  const AI_GUEST_ID = 'ai-assistant-myai'

  interface ChatRoomProps {
    room: RoomPublic
    initialMessages: Message[]
  }

  export function ChatRoom({ room, initialMessages }: ChatRoomProps) {
    const router = useRouter()
    const isClosingRef = useRef(false)
    const [guestId, setGuestId] = useState<string>('')
    const [displayName, setDisplayNameState] = useState<string | null>(null)
    const [hasJoinedThisRoom, setHasJoinedThisRoom] = useState(false)
    const [isClosing, setIsClosing] = useState(false)

    const { messages, addMessage, addOptimistic, confirmOptimistic } =
      useRealtimeMessages(room.id, initialMessages, isClosingRef)  // ← pass isClosingRef

    // Hydrate guest identity from localStorage (client-side only)
    useEffect(() => {
      setGuestId(getOrCreateGuestId())
      setDisplayNameState(getDisplayName())
      setHasJoinedThisRoom(hasJoinedRoom(room.slug))  // ← use slug
    }, [room.slug])

    const handleJoined = (name: string) => {
      setDisplayNameState(name)
      // Replace markRoomJoined with addJoinedRoom (slug-based)
      addJoinedRoom({
        slug: room.slug,
        name: room.name,
        room_type: room.room_type,
        joinedAt: new Date().toISOString(),
      })
      setHasJoinedThisRoom(true)
    }

    const handleCloseRoom = async () => {
      const name = displayName ?? 'Someone'
      isClosingRef.current = true
      setIsClosing(true)

      const result = await closeRoom(room.id, name)

      if (!result.success) {
        isClosingRef.current = false
        setIsClosing(false)
        toast.error(result.error ?? 'Failed to close room. Please try again.')
        return
      }

      // Success: navigate immediately (don't wait for realtime echo)
      router.push('/')
    }

    const handleOptimisticSend = (tempId: string, body: string) => {
      const optimistic: Message = {
        id: tempId,
        room_id: room.id,
        sender_guest_id: guestId,
        sender_name: displayName ?? 'You',
        body,
        created_at: new Date().toISOString(),
      }
      addOptimistic(tempId, optimistic)
    }

    const handleMessageConfirmed = (tempId: string, realMessage: Message) => {
      confirmOptimistic(tempId, realMessage)
      if (realMessage.body.toLowerCase().includes('@myai')) {
        getAIResponse(room.id, realMessage.body, messages).then((result) => {
          if (result.success && result.message) {
            addMessage(result.message)
          }
        })
      }
    }

    const needsJoin = !displayName || (room.room_type === 'secured' && !hasJoinedThisRoom)
    if (needsJoin) {
      return (
        <div className="flex flex-col h-full">
          <RoomHeader room={room} />
          <JoinRoomForm room={room} onJoined={handleJoined} />
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        <RoomHeader
          room={room}
          onCloseRoom={handleCloseRoom}
          isClosing={isClosing}
        />
        <MessageList messages={messages} currentGuestId={guestId} aiGuestId={AI_GUEST_ID} />
        <MessageComposer
          roomId={room.id}
          guestId={guestId}
          senderName={displayName}
          onOptimisticSend={handleOptimisticSend}
          onMessageConfirmed={handleMessageConfirmed}
        />
      </div>
    )
  }
  ```

  > **Note:** We pass `onCloseRoom` and `isClosing` as props to `RoomHeader`. The `AlertDialog` lives in `RoomHeader` (next step) to keep `ChatRoom` focused.

- [ ] **Step 2: Update `RoomHeader` to include the Close button**

  Replace `src/features/rooms/components/room-header.tsx` with:

  ```tsx
  'use client'

  import { Trash2 } from 'lucide-react'
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from '@/components/ui/alert-dialog'
  import { Button } from '@/components/ui/button'
  import { RoomTypeBadge } from './room-type-badge'
  import { CopyLinkButton } from './copy-link-button'
  import type { RoomPublic } from '../types/room.types'

  interface RoomHeaderProps {
    room: RoomPublic
    onCloseRoom?: () => void
    isClosing?: boolean
  }

  export function RoomHeader({ room, onCloseRoom, isClosing }: RoomHeaderProps) {
    return (
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-gray-950 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold truncate">{room.name}</h1>
          <RoomTypeBadge type={room.room_type as 'open' | 'secured'} />
        </div>
        <div className="flex items-center gap-2">
          <CopyLinkButton slug={room.slug} />
          {onCloseRoom && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  disabled={isClosing}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {isClosing ? 'Closing…' : 'Close room'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close this room?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the room and all its messages.
                    Everyone will be removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onCloseRoom}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Close room
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>
    )
  }
  ```

  > `RoomHeader` is now a client component (needs `'use client'` for AlertDialog interactivity).

- [ ] **Step 3: Check shadcn AlertDialog is installed**

  ```bash
  ls src/components/ui/alert-dialog.tsx 2>/dev/null || echo "MISSING"
  ```

  If missing, install it:
  ```bash
  pnpm dlx shadcn@latest add alert-dialog
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  pnpm tsc --noEmit
  ```

- [ ] **Step 5: Manual smoke test**

  ```bash
  pnpm dev
  ```

  Open a room, click "Close room", confirm — verify you are redirected to home. Open a second browser/tab in the same room and verify it shows the toast and redirects after 2 seconds.

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/chat/components/chat-room.tsx \
          src/features/rooms/components/room-header.tsx
  git commit -m "feat: add Close Room button with realtime broadcast to room page"
  ```

---

## Task 8: Create `YourRoomsList` Component

**Files:**
- Create: `src/features/rooms/components/your-rooms-list.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  'use client'

  import { useEffect, useState, useTransition } from 'react'
  import { useRouter } from 'next/navigation'
  import { toast } from 'sonner'
  import { MessageCircle, Lock, ArrowRight, Trash2, RefreshCw } from 'lucide-react'
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from '@/components/ui/alert-dialog'
  import { Button } from '@/components/ui/button'
  import { Skeleton } from '@/components/ui/skeleton'
  import { getJoinedRooms, removeJoinedRoom, getDisplayName } from '@/lib/auth/guest-session'
  import { getRoomsBySlugs, type RoomStatus } from '../actions/get-rooms-by-slugs'
  import { closeRoom } from '../actions/close-room'

  function formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime()
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  export function YourRoomsList() {
    const router = useRouter()
    const [rooms, setRooms] = useState<RoomStatus[]>([])
    const [joinedAtMap, setJoinedAtMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [closingId, setClosingId] = useState<string | null>(null)
    const [hasSlugs, setHasSlugs] = useState(false)

    const fetchRooms = async () => {
      setError(false)
      setLoading(true)

      const stored = getJoinedRooms()
      if (stored.length === 0) {
        setHasSlugs(false)
        setLoading(false)
        return
      }

      setHasSlugs(true)

      // Build joinedAt lookup
      const atMap: Record<string, string> = {}
      for (const r of stored) atMap[r.slug] = r.joinedAt
      setJoinedAtMap(atMap)

      const result = await getRoomsBySlugs(stored.map((r) => r.slug))

      if (!result.success) {
        setError(true)
        setLoading(false)
        return
      }

      // Remove from localStorage any slugs that no longer exist on the server
      const returnedSlugs = new Set(result.rooms.map((r) => r.slug))
      for (const r of stored) {
        if (!returnedSlugs.has(r.slug)) removeJoinedRoom(r.slug)
      }

      setRooms(result.rooms)
      setLoading(false)
    }

    useEffect(() => {
      fetchRooms()
    }, [])

    const handleClose = async (room: RoomStatus) => {
      const displayName = getDisplayName() ?? 'Someone'
      setClosingId(room.id)

      const result = await closeRoom(room.id, displayName)

      setClosingId(null)

      if (!result.success) {
        toast.error(result.error ?? 'Failed to close room.')
        return
      }

      // Optimistically remove from list
      setRooms((prev) => prev.filter((r) => r.id !== room.id))
      removeJoinedRoom(room.slug)
      toast.success(`"${room.name}" has been closed.`)
    }

    // Hidden entirely when no rooms have ever been stored
    if (!hasSlugs && !loading) return null

    return (
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Your Rooms
          </h2>
          {!loading && rooms.length > 0 && (
            <span className="text-xs text-muted-foreground">{rooms.length} active</span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center justify-between p-4 rounded-xl border border-dashed text-muted-foreground text-sm">
            <span>Could not load your rooms.</span>
            <Button variant="ghost" size="sm" onClick={fetchRooms}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty: all stored slugs were stale (rooms deleted) */}
        {!loading && !error && rooms.length === 0 && hasSlugs && null}

        {/* Populated */}
        {!loading && !error && rooms.length > 0 && (
          <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {room.room_type === 'secured' ? (
                      <Lock className="w-4 h-4 text-primary" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{room.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          room.room_type === 'secured'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                        }`}
                      >
                        {room.room_type === 'secured' ? 'Secured' : 'Open'}
                      </span>
                      {joinedAtMap[room.slug] && (
                        <span className="text-xs text-muted-foreground">
                          Joined {formatRelativeTime(joinedAtMap[room.slug])}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/room/${room.slug}`)}
                  >
                    <ArrowRight className="w-3.5 h-3.5 mr-1" />
                    Rejoin
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                        disabled={closingId === room.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Close room</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Close "{room.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the room and all its messages.
                          Everyone will be removed. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleClose(room)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Close room
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }
  ```

  > Check if `Skeleton` is installed: `ls src/components/ui/skeleton.tsx 2>/dev/null`. If missing: `pnpm dlx shadcn@latest add skeleton`.

- [ ] **Step 2: Verify no TypeScript errors**

  ```bash
  pnpm tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/rooms/components/your-rooms-list.tsx
  git commit -m "feat: add YourRoomsList component for home screen room management"
  ```

---

## Task 9: Update Home Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `YourRoomsList` and `?closed=1` toast handling**

  Replace `src/app/page.tsx` with:

  ```tsx
  'use client'

  import { useEffect } from 'react'
  import { useRouter, useSearchParams } from 'next/navigation'
  import Link from 'next/link'
  import { toast } from 'sonner'
  import { ArrowRight, Zap, Lock, MessageCircle } from 'lucide-react'
  import { JoinRoomInput } from '@/features/rooms/components/join-room-input'
  import { YourRoomsList } from '@/features/rooms/components/your-rooms-list'

  export default function HomePage() {
    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
      if (searchParams.get('closed') === '1') {
        toast.info('That room no longer exists.')
        router.replace('/')
      }
    }, [searchParams, router])

    return (
      <main className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">ChatboxAI</span>
          </div>
          <Link
            href="/create"
            className="text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create room
          </Link>
        </nav>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Zap className="w-3 h-3" />
            Real-time chat, zero friction
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Create a room.<br />
            Share a link.<br />
            <span className="text-primary">Chat instantly.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            No signup needed. Create a chat room in seconds, share the link with anyone,
            and start chatting in real time from any device.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Create a room
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-sm text-muted-foreground">or join an existing room</p>
              <JoinRoomInput />
            </div>
          </div>
        </section>

        {/* Your Rooms */}
        <YourRoomsList />

        {/* Features */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Instant rooms',
                description: 'Create a room in under a minute. Share the link and your guests are in.',
              },
              {
                icon: MessageCircle,
                title: 'Real-time chat',
                description: 'Messages appear instantly for everyone in the room. No refresh needed.',
              },
              {
                icon: Lock,
                title: 'Secured rooms',
                description: 'Protect your room with a secret code. Only invited guests can join.',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="p-6 rounded-xl border bg-card">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-8 text-center text-sm text-muted-foreground">
          <p>ChatboxAI — Chat without barriers</p>
        </footer>
      </main>
    )
  }
  ```

  > The home page now requires `'use client'` because it uses `useSearchParams` and `useEffect`. Next.js requires client components to use these hooks. If you want to keep the page as a Server Component, wrap only the toast logic in a separate `<ClosedRoomToast />` client component that reads searchParams. Either approach is fine.

- [ ] **Step 2: Verify TypeScript and run dev server**

  ```bash
  pnpm tsc --noEmit
  pnpm dev
  ```

  Manual verification checklist:
  - [ ] Home page shows "Your Rooms" section if you have rooms in localStorage
  - [ ] Rooms show with correct type badges and relative times
  - [ ] "Rejoin" navigates to the room
  - [ ] "Close" button opens confirmation dialog
  - [ ] Confirming close removes room from list and shows success toast
  - [ ] Visiting a closed room URL redirects to home with "That room no longer exists" toast
  - [ ] Opening a room in two tabs, closing from one tab shows toast + redirect in the other tab

- [ ] **Step 3: Run all unit tests**

  ```bash
  pnpm vitest run
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/page.tsx
  git commit -m "feat: add YourRoomsList to home page and handle ?closed=1 redirect"
  ```

---

## Done

All tasks complete. The feature is fully implemented:
- `supabase/schema.sql` and `database.ts` updated with `closed_by_name`
- `guest-session.ts` tracks joined rooms as `JoinedRoom[]` with slug-based lookup
- `close-room` server action soft-closes then hard-deletes rooms
- `get-rooms-by-slugs` server action provides home screen room status
- Room page redirects closed rooms to `/?closed=1`
- `use-realtime-messages` broadcasts close events to all room members
- Room page has a Close Room button with confirmation dialog
- Home page shows "Your Rooms" list with Rejoin and Close actions
