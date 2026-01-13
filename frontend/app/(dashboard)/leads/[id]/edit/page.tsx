'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { leadsApi } from '@/lib/api/leads'
import { Lead } from '@/lib/types/lead'
import { Button } from '@/components/ui/button'
import { LeadForm } from '@/components/leads/LeadForm'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft } from 'lucide-react'

export default function EditLeadPage() {
  const params = useParams()
  const { toast } = useToast()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLead()
  }, [params.id])

  const fetchLead = async () => {
    try {
      const data = await leadsApi.get(params.id as string)
      setLead(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch lead',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Loading...</p>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Lead not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-6">
        <Link href={`/leads/${lead.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lead
          </Button>
        </Link>
      </div>

      <LeadForm lead={lead} mode="edit" />
    </div>
  )
}
