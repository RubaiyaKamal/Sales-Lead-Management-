'use client'

import Link from 'next/link'
import { LeadWithScore } from '@/lib/types/lead'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash2 } from 'lucide-react'

interface LeadTableProps {
  leads: LeadWithScore[]
  onDelete?: (id: string) => void
  canDelete?: boolean
}

export function LeadTable({ leads, onDelete, canDelete = false }: LeadTableProps) {
  const getStatusBadgeVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
      new: 'default',
      contacted: 'warning',
      qualified: 'success',
      unqualified: 'destructive',
      converted: 'secondary',
    }
    return variants[status] || 'default'
  }

  const getQualificationBadgeVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
      not_qualified: 'secondary',
      in_progress: 'warning',
      qualified: 'success',
      disqualified: 'destructive',
    }
    return variants[status] || 'default'
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No leads found</p>
        <Link href="/leads/new">
          <Button className="mt-4">Create First Lead</Button>
        </Link>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Qualification</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell className="font-medium">{lead.name}</TableCell>
            <TableCell>{lead.email}</TableCell>
            <TableCell>{lead.company || '-'}</TableCell>
            <TableCell className="capitalize">{lead.lead_source.replace('_', ' ')}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(lead.status)}>
                {lead.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getQualificationBadgeVariant(lead.qualification_status)}>
                {lead.qualification_status.replace('_', ' ')}
              </Badge>
            </TableCell>
            <TableCell>
              {lead.lead_score ? (
                <span className="font-semibold">{lead.lead_score.total_score}/100</span>
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell>{formatDate(lead.created_at)}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Link href={`/leads/${lead.id}`}>
                  <Button variant="ghost" size="icon" title="View">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/leads/${lead.id}/edit`}>
                  <Button variant="ghost" size="icon" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                {canDelete && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    onClick={() => onDelete(lead.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
