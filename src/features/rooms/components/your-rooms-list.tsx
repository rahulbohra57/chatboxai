'use client'

import { useEffect, useState, useCallback } from 'react'
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

  const fetchRooms = useCallback(async () => {
    setError(false)
    setLoading(true)

    const stored = getJoinedRooms()
    if (stored.length === 0) {
      setLoading(false)
      return
    }

    const atMap: Record<string, string> = {}
    for (const r of stored) atMap[r.slug] = r.joinedAt
    setJoinedAtMap(atMap)

    const result = await getRoomsBySlugs(stored.slice(0, 20).map((r) => r.slug))

    if (!result.success) {
      setError(true)
      setLoading(false)
      return
    }

    const returnedSlugs = new Set(result.rooms.map((r) => r.slug))
    for (const r of stored) {
      if (!returnedSlugs.has(r.slug)) removeJoinedRoom(r.slug)
    }

    setRooms(result.rooms)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const handleClose = async (room: RoomStatus) => {
    const displayName = getDisplayName() ?? 'Someone'
    setClosingId(room.id)

    const result = await closeRoom(room.id, displayName)

    setClosingId(null)

    if (!result.success) {
      toast.error(result.error ?? 'Failed to close room.')
      return
    }

    setRooms((prev) => prev.filter((r) => r.id !== room.id))
    removeJoinedRoom(room.slug)
    toast.success(`"${room.name}" has been closed.`)
  }

  if (!loading && !error && rooms.length === 0) return null

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

      {loading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-dashed text-muted-foreground text-sm">
          <span>Could not load your rooms.</span>
          <Button variant="ghost" size="sm" onClick={fetchRooms} disabled={closingId !== null}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

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
                  disabled={closingId !== null}
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1" />
                  Rejoin
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                        disabled={closingId === room.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Close room</span>
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Close &ldquo;{room.name}&rdquo;?</AlertDialogTitle>
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
