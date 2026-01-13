'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LeadForm } from '@/components/leads/LeadForm'
import { ArrowLeft } from 'lucide-react'

export default function NewLeadPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-6">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </Link>
      </div>

      <LeadForm mode="create" />
    </div>
  )
}
