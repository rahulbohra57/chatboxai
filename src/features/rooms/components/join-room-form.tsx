'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { joinRoomSchema, type JoinRoomInput } from '../schemas/room.schema'
import { joinRoom } from '../actions/join-room'
import { setDisplayName } from '@/lib/auth/guest-session'
import { RoomTypeBadge } from './room-type-badge'
import type { RoomPublic } from '../types/room.types'

interface JoinRoomFormProps {
  room: RoomPublic
  onJoined: (displayName: string) => void
}

export function JoinRoomForm({ room, onJoined }: JoinRoomFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<JoinRoomInput>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      display_name: '',
      secret_code: '',
    },
  })

  const onSubmit = (data: JoinRoomInput) => {
    startTransition(async () => {
      const result = await joinRoom(room.slug, data)
      if (!result.success) {
        if (
          result.error.toLowerCase().includes('secret') ||
          result.error.toLowerCase().includes('code')
        ) {
          form.setError('secret_code', { message: result.error })
        } else {
          toast.error(result.error)
        }
        return
      }
      setDisplayName(data.display_name)
      onJoined(data.display_name)
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{room.name}</h2>
          <div className="flex justify-center">
            <RoomTypeBadge type={room.room_type as 'open' | 'secured'} />
          </div>
          <p className="text-sm text-muted-foreground">
            Enter your name to join the conversation
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="display_name" className="text-sm font-medium">
              Display name
            </label>
            <input
              id="display_name"
              type="text"
              placeholder="How should people call you?"
              autoFocus
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...form.register('display_name')}
            />
            {form.formState.errors.display_name && (
              <p className="text-sm text-red-500">
                {form.formState.errors.display_name.message}
              </p>
            )}
          </div>

          {room.room_type === 'secured' && (
            <div className="space-y-2">
              <label htmlFor="secret_code" className="text-sm font-medium">
                Secret code
              </label>
              <input
                id="secret_code"
                type="password"
                placeholder="Enter the room code"
                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...form.register('secret_code')}
              />
              {form.formState.errors.secret_code && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.secret_code.message}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Joining...' : 'Join room'}
          </button>
        </form>
      </div>
    </div>
  )
}
