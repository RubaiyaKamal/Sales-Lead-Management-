'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { leadsApi } from '@/lib/api/leads'
import { LeadWithScore } from '@/lib/types/lead'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Pencil, Trash2, Sparkles } from 'lucide-react'

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [lead, setLead] = useState<LeadWithScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [qualifying, setQualifying] = useState(false)

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

  const handleQualify = async () => {
    if (!lead) return
    setQualifying(true)
    try {
      await leadsApi.qualify(lead.id)
      toast({
        title: 'Success',
        description: 'Lead qualified successfully',
      })
      fetchLead()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to qualify lead',
        variant: 'destructive',
      })
    } finally {
      setQualifying(false)
    }
  }

  const handleDelete = async () => {
    if (!lead || !confirm('Are you sure you want to delete this lead?')) return

    try {
      await leadsApi.delete(lead.id)
      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      })
      router.push('/leads')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <div className="container mx-auto py-8 px-4"><p>Loading...</p></div>
  }

  if (!lead) {
    return <div className="container mx-auto py-8 px-4"><p>Lead not found</p></div>
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{lead.name}</h1>
          <p className="text-gray-600">{lead.email}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleQualify} disabled={qualifying}>
            <Sparkles className="h-4 w-4 mr-2" />
            {qualifying ? 'Qualifying...' : 'AI Qualify'}
          </Button>
          <Link href={`/leads/${lead.id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lead Information */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p>{lead.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Phone</label>
              <p>{lead.phone || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Company</label>
              <p>{lead.company || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Source</label>
              <p className="capitalize">{lead.lead_source.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <div className="mt-1">
                <Badge>{lead.status}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Qualification Status</label>
              <div className="mt-1">
                <Badge>{lead.qualification_status.replace('_', ' ')}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p>{formatDateTime(lead.created_at)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Updated</label>
              <p>{formatDateTime(lead.updated_at)}</p>
            </div>
            {lead.last_contacted_at && (
              <div>
                <label className="text-sm font-medium text-gray-500">Last Contacted</label>
                <p>{formatDateTime(lead.last_contacted_at)}</p>
              </div>
            )}
            {lead.converted_at && (
              <div>
                <label className="text-sm font-medium text-gray-500">Converted</label>
                <p>{formatDateTime(lead.converted_at)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Qualification Score */}
        {lead.lead_score && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>AI Qualification Score (BANT)</CardTitle>
              <CardDescription>Total Score: {lead.lead_score.total_score}/100</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Budget</label>
                  <p className="text-2xl font-bold">{lead.lead_score.budget_score}/25</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Authority</label>
                  <p className="text-2xl font-bold">{lead.lead_score.authority_score}/25</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Need</label>
                  <p className="text-2xl font-bold">{lead.lead_score.need_score}/25</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Timeline</label>
                  <p className="text-2xl font-bold">{lead.lead_score.timeline_score}/25</p>
                </div>
              </div>
              {lead.lead_score.reasoning && (
                <div>
                  <label className="text-sm font-medium text-gray-500">AI Reasoning</label>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{lead.lead_score.reasoning}</p>
                </div>
              )}
              {lead.lead_score.confidence && (
                <div className="mt-3">
                  <label className="text-sm font-medium text-gray-500">Confidence</label>
                  <p>{Math.round(lead.lead_score.confidence * 100)}%</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
