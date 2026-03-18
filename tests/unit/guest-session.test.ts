import { describe, it, expect, beforeEach } from 'vitest'
import {
  getOrCreateGuestId,
  getDisplayName,
  setDisplayName,
  clearDisplayName,
  getGuestIdentity,
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
