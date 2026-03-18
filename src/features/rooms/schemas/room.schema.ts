import { z } from 'zod'

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name is too long'),
  room_type: z.enum(['open', 'secured']),
  secret_code: z
    .string()
    .min(4, 'Secret code must be at least 4 characters')
    .max(64, 'Secret code is too long')
    .optional(),
}).refine(
  (data) => data.room_type !== 'secured' || !!data.secret_code,
  {
    message: 'Secret code is required for secured rooms',
    path: ['secret_code'],
  }
)

export const joinRoomSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name is too long')
    .trim(),
  secret_code: z.string().optional(),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type JoinRoomInput = z.infer<typeof joinRoomSchema>
