'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createRoomSchema, type CreateRoomInput } from '../schemas/room.schema'
import { createRoom } from '../actions/create-room'
import { getOrCreateGuestId } from '@/lib/auth/guest-session'

export function CreateRoomForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [roomType, setRoomType] = useState<'open' | 'secured'>('open')

  const form = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      room_type: 'open',
      secret_code: undefined,
    },
  })

  const onSubmit = (data: CreateRoomInput) => {
    startTransition(async () => {
      const guestId = getOrCreateGuestId()
      const result = await createRoom(data, guestId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Room created!')
      router.push(`/room/${result.slug}`)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Room Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Room name
        </label>
        <input
          id="name"
          type="text"
          placeholder="e.g. Team Standup, Book Club..."
          className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* Room Type */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Room type</label>
        <div className="grid grid-cols-2 gap-3">
          {(['open', 'secured'] as const).map((type) => (
            <label
              key={type}
              className={`flex flex-col gap-1 p-3 rounded-md border cursor-pointer transition-colors ${
                roomType === type
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                value={type}
                className="sr-only"
                {...form.register('room_type')}
                onChange={() => {
                  setRoomType(type)
                  form.setValue('room_type', type)
                  if (type === 'open') {
                    form.setValue('secret_code', undefined)
                    form.clearErrors('secret_code')
                  }
                }}
              />
              <span className="font-medium text-sm capitalize">{type}</span>
              <span className="text-xs text-muted-foreground">
                {type === 'open'
                  ? 'Anyone with the link can join'
                  : 'Requires a secret code to join'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Secret code (only for secured) */}
      {roomType === 'secured' && (
        <div className="space-y-2">
          <label htmlFor="secret_code" className="text-sm font-medium">
            Secret code
          </label>
          <input
            id="secret_code"
            type="password"
            placeholder="Min 4 characters"
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
        {isPending ? 'Creating room...' : 'Create room'}
      </button>
    </form>
  )
}
