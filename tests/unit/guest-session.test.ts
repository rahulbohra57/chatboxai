import { describe, it, expect, beforeEach } from 'vitest'
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

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear()
})

describe('getOrCreateGuestId', () => {
  it('returns a UUID string', () => {
    const id = getOrCreateGuestId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('returns the same ID on subsequent calls', () => {
    const id1 = getOrCreateGuestId()
    const id2 = getOrCreateGuestId()
    expect(id1).toBe(id2)
  })
})

describe('display name', () => {
  it('returns null when no name set', () => {
    expect(getDisplayName()).toBeNull()
  })

  it('stores and retrieves display name', () => {
    setDisplayName('Alice')
    expect(getDisplayName()).toBe('Alice')
  })

  it('trims whitespace from display name', () => {
    setDisplayName('  Bob  ')
    expect(getDisplayName()).toBe('Bob')
  })

  it('clearDisplayName removes the name', () => {
    setDisplayName('Alice')
    clearDisplayName()
    expect(getDisplayName()).toBeNull()
  })
})

describe('getGuestIdentity', () => {
  it('returns guestId and displayName', () => {
    setDisplayName('Alice')
    const { guestId, displayName } = getGuestIdentity()
    expect(guestId).toBeTruthy()
    expect(displayName).toBe('Alice')
  })

  it('displayName is null when not set', () => {
    const { displayName } = getGuestIdentity()
    expect(displayName).toBeNull()
  })
})

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
