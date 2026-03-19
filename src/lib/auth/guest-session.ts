// Client-side only: uses localStorage for persistent guest identity
// This is convenience state, not secure authentication

const GUEST_ID_KEY = 'chatboxai_guest_id'
const DISPLAY_NAME_KEY = 'chatboxai_display_name'
const JOINED_ROOMS_KEY = 'chatboxai_joined_rooms'

/**
 * Returns the stored guest ID, or creates and stores a new one.
 * Stable across page reloads for the same browser.
 */
export function getOrCreateGuestId(): string {
  // Guard: only runs in browser
  if (typeof window === 'undefined') return ''

  const existing = localStorage.getItem(GUEST_ID_KEY)
  if (existing) return existing

  const newId = crypto.randomUUID()
  localStorage.setItem(GUEST_ID_KEY, newId)
  return newId
}

/**
 * Returns the stored display name, or null if not set.
 */
export function getDisplayName(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(DISPLAY_NAME_KEY)
}

/**
 * Stores a display name for the guest.
 */
export function setDisplayName(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim())
}

/**
 * Clears the stored display name (e.g., on room leave).
 */
export function clearDisplayName(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DISPLAY_NAME_KEY)
}

/**
 * Returns the full guest identity (guestId + displayName).
 * Useful for initializing chat state.
 */
export function getGuestIdentity(): { guestId: string; displayName: string | null } {
  return {
    guestId: getOrCreateGuestId(),
    displayName: getDisplayName(),
  }
}

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
