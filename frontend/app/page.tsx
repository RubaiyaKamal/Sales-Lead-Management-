'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth/auth-client'

export default function Home() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (!isPending) {
      if (session) {
        router.push('/leads')
      } else {
        router.push('/login')
      }
    }
  }, [session, isPending, router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Sales Lead Management</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </main>
  )
}
