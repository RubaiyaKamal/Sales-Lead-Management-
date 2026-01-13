'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { leadsApi } from '@/lib/api/leads'
import { LeadWithScore, LeadListQuery, LeadStatus, QualificationStatus, LeadSource } from '@/lib/types/lead'
import { LeadTable } from '@/components/leads/LeadTable'
import { Pagination } from '@/components/leads/Pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Search } from 'lucide-react'

export default function LeadsPage() {
  const { toast } = useToast()

  const [leads, setLeads] = useState<LeadWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [itemsPerPage] = useState(20)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [qualificationFilter, setQualificationFilter] = useState<QualificationStatus | 'all'>('all')
  const [sourceFilter] = useState<LeadSource | 'all'>('all')

  useEffect(() => {
    fetchLeads()
  }, [currentPage, statusFilter, qualificationFilter, sourceFilter])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const query: LeadListQuery = {
        page: currentPage,
        limit: itemsPerPage,
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(qualificationFilter !== 'all' && { qualification_status: qualificationFilter }),
        ...(sourceFilter !== 'all' && { lead_source: sourceFilter }),
        sortBy: 'created_at',
        sortOrder: 'desc',
      }

      const response = await leadsApi.list(query)
      setLeads(response.data)
      setTotalPages(response.pagination.totalPages)
      setTotalItems(response.pagination.total)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch leads',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchLeads()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) {
      return
    }

    try {
      await leadsApi.delete(id)
      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      })
      fetchLeads()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete lead',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Leads</h1>
        <Link href="/leads/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="unqualified">Unqualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>

            {/* Qualification Filter */}
            <Select value={qualificationFilter} onValueChange={(value) => setQualificationFilter(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Qualification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Qualifications</SelectItem>
                <SelectItem value="not_qualified">Not Qualified</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading leads...</p>
            </div>
          ) : (
            <>
              <LeadTable leads={leads} onDelete={handleDelete} canDelete={true} />
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
