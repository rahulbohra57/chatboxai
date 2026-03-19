'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export function ClosedRoomToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  useEffect(() => {
    if (searchParams.get('closed') === '1') {
      toast.info('That room no longer exists.')
      router.replace('/')
    }
  }, [searchParams, router])
  return null
}
