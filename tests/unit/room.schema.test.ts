import { describe, it, expect } from 'vitest'
import { createRoomSchema, joinRoomSchema } from '@/features/rooms/schemas/room.schema'

describe('createRoomSchema', () => {
  it('accepts valid open room', () => {
    const result = createRoomSchema.safeParse({
      name: 'My Room',
      room_type: 'open',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid secured room with secret code', () => {
    const result = createRoomSchema.safeParse({
      name: 'Secret Room',
      room_type: 'secured',
      secret_code: 'mycode123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects secured room without secret code', () => {
    const result = createRoomSchema.safeParse({
      name: 'Secret Room',
      room_type: 'secured',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('secret_code')
    }
  })

  it('rejects empty name', () => {
    const result = createRoomSchema.safeParse({
      name: '',
      room_type: 'open',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    const result = createRoomSchema.safeParse({
      name: 'a'.repeat(101),
      room_type: 'open',
    })
    expect(result.success).toBe(false)
  })

  it('rejects secret code shorter than 4 chars', () => {
    const result = createRoomSchema.safeParse({
      name: 'Room',
      room_type: 'secured',
      secret_code: 'ab',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid room_type', () => {
    const result = createRoomSchema.safeParse({
      name: 'Room',
      room_type: 'public',
    })
    expect(result.success).toBe(false)
  })
})

describe('joinRoomSchema', () => {
  it('accepts valid display name', () => {
    const result = joinRoomSchema.safeParse({ display_name: 'Alice' })
    expect(result.success).toBe(true)
  })

  it('accepts display name with secret code', () => {
    const result = joinRoomSchema.safeParse({
      display_name: 'Alice',
      secret_code: 'mycode',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty display name', () => {
    const result = joinRoomSchema.safeParse({ display_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects display name longer than 50 chars', () => {
    const result = joinRoomSchema.safeParse({
      display_name: 'a'.repeat(51),
    })
    expect(result.success).toBe(false)
  })
})
