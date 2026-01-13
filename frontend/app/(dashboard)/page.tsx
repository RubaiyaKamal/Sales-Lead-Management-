'use client'

import { useState, useEffect } from 'react'
import { leadsApi } from '@/lib/api/leads'
import { LeadWithScore, QualificationStatus, LeadStatus } from '@/lib/types/lead'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, DollarSign, TrendingUp, Clock } from 'lucide-react'

interface DashboardStats {
  totalLeads: number
  qualifiedLeads: number
  conversionRate: number
  avgQualificationScore: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [leads, setLeads] = useState<LeadWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get all leads for analysis
      const response = await leadsApi.list({ page: 1, limit: 1000 }) // Get all leads
      const allLeads = response.data

      setLeads(allLeads)

      // Calculate stats
      const totalLeads = allLeads.length
      const qualifiedLeads = allLeads.filter(l => l.qualification_status === 'qualified').length
      const convertedLeads = allLeads.filter(l => l.status === 'converted').length
      const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

      let totalScore = 0
      let scoredLeadsCount = 0
      allLeads.forEach(lead => {
        if (lead.lead_score) {
          totalScore += lead.lead_score.total_score
          scoredLeadsCount++
        }
      })
      const avgQualificationScore = scoredLeadsCount > 0 ? Math.round(totalScore / scoredLeadsCount) : 0

      setStats({
        totalLeads,
        qualifiedLeads,
        conversionRate,
        avgQualificationScore
      })

      // Prepare chart data
      const statusCounts: Record<LeadStatus | string, number> = {
        new: 0,
        contacted: 0,
        qualified: 0,
        unqualified: 0,
        converted: 0
      }

      const qualificationCounts: Record<QualificationStatus | string, number> = {
        not_qualified: 0,
        in_progress: 0,
        qualified: 0,
        disqualified: 0
      }

      allLeads.forEach(lead => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
        qualificationCounts[lead.qualification_status] = (qualificationCounts[lead.qualification_status] || 0) + 1
      })

      setChartData([
        {
          name: 'Status Distribution',
          data: Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
        },
        {
          name: 'Qualification Distribution',
          data: Object.entries(qualificationCounts).map(([name, value]) => ({ name, value }))
        }
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-center text-gray-500">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.qualifiedLeads || 0}</div>
            <p className="text-xs text-muted-foreground">+8% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">+5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Qualification Score</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgQualificationScore || 0}/100</div>
            <p className="text-xs text-muted-foreground">+3 points from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData[0]?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Qualification Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Qualification Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData[1]?.data || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {chartData[1]?.data?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Company</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Qualification</th>
                  <th className="text-left py-2">Score</th>
                  <th className="text-left py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 5).map((lead) => (
                  <tr key={lead.id} className="border-b">
                    <td className="py-2 font-medium">{lead.name}</td>
                    <td className="py-2">{lead.company || '-'}</td>
                    <td className="py-2">
                      <Badge variant="outline">{lead.status}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={
                        lead.qualification_status === 'qualified' ? 'success' :
                        lead.qualification_status === 'in_progress' ? 'warning' :
                        lead.qualification_status === 'disqualified' ? 'destructive' : 'secondary'
                      }>
                        {lead.qualification_status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {lead.lead_score ? `${lead.lead_score.total_score}/100` : '-'}
                    </td>
                    <td className="py-2">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}