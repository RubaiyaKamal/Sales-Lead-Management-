'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { leadsApi } from '@/lib/api/leads'
import { Lead, LeadSource, LeadStatus } from '@/lib/types/lead'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().max(255).optional(),
  leadSource: z.enum(['website', 'referral', 'ad', 'cold_outreach']),
  status: z.enum(['new', 'contacted', 'qualified', 'unqualified', 'converted']).optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

interface LeadFormProps {
  lead?: Lead
  mode: 'create' | 'edit'
}

export function LeadForm({ lead, mode }: LeadFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ? {
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      company: lead.company || '',
      leadSource: lead.lead_source,
      status: lead.status,
    } : {
      leadSource: 'website',
      status: 'new',
    },
  })

  const onSubmit = async (data: LeadFormData) => {
    setLoading(true)
    try {
      if (mode === 'create') {
        const newLead = await leadsApi.create({
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          company: data.company || undefined,
          leadSource: data.leadSource,
        })
        toast({
          title: 'Success',
          description: 'Lead created successfully',
        })
        router.push(`/leads/${newLead.id}`)
      } else if (lead) {
        await leadsApi.update(lead.id, {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          company: data.company || null,
          status: data.status,
          previousUpdatedAt: lead.updated_at,
        })
        toast({
          title: 'Success',
          description: 'Lead updated successfully',
        })
        router.push(`/leads/${lead.id}`)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${mode} lead`,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const leadSource = watch('leadSource')
  const status = watch('status')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create New Lead' : 'Edit Lead'}</CardTitle>
        <CardDescription>
          {mode === 'create' ? 'Add a new lead to your pipeline' : 'Update lead information'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="John Doe"
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="john@example.com"
              disabled={loading}
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              placeholder="+1234567890"
              disabled={loading}
            />
            {errors.phone && (
              <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              {...register('company')}
              placeholder="Acme Corp"
              disabled={loading}
            />
            {errors.company && (
              <p className="text-sm text-red-500 mt-1">{errors.company.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="leadSource">Lead Source *</Label>
            <Select
              value={leadSource}
              onValueChange={(value) => setValue('leadSource', value as LeadSource)}
              disabled={mode === 'edit' || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="ad">Advertisement</SelectItem>
                <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
              </SelectContent>
            </Select>
            {errors.leadSource && (
              <p className="text-sm text-red-500 mt-1">{errors.leadSource.message}</p>
            )}
          </div>

          {mode === 'edit' && (
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as LeadStatus)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : mode === 'create' ? 'Create Lead' : 'Update Lead'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
