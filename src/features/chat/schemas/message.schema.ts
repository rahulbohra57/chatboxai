import { z } from 'zod'

export const sendMessageSchema = z.object({
  room_id: z.string().uuid('Invalid room ID'),
  sender_guest_id: z.string().min(1, 'Guest ID is required'),
  sender_name: z.string().min(1, 'Sender name is required').max(50),
  body: z.string().min(1, 'Message cannot be empty'),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
