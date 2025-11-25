'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, MoreHorizontal, Eye, Edit, CheckCircle, XCircle, Clock } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Registration {
  id: string
  tournament_id: string
  team_id: string
  status: 'pending' | 'approved' | 'rejected'
  registered_at: string
  tournament_name?: string
  team_name?: string
  captain_name?: string
}

export default function RegistrationsTable() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchRegistrations()
  }, [])

  const fetchRegistrations = async () => {
    try {
      // Fetch all tournaments to get their registrations
      const tournamentsResponse = await fetch('/api/tournaments')
      const tournaments = await tournamentsResponse.json()
      
      const allRegistrations: Registration[] = []
      
      for (const tournament of tournaments) {
        try {
          const regResponse = await fetch(`/api/tournaments/${tournament.id}/registrations`)
          const tournamentRegistrations = await regResponse.json()
          
          const enrichedRegistrations = tournamentRegistrations.map((reg: Registration) => ({
            ...reg,
            tournament_name: tournament.name,
            team_name: reg.team_name || 'Unknown Team',
            captain_name: reg.captain_name || 'Unknown Captain'
          }))
          
          allRegistrations.push(...enrichedRegistrations)
        } catch (error) {
          console.error(`Error fetching registrations for tournament ${tournament.id}:`, error)
        }
      }
      
      // Sort by registration date (newest first)
      allRegistrations.sort((a, b) => 
        new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime()
      )
      
      setRegistrations(allRegistrations)
    } catch (error) {
      console.error('Error fetching registrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRegistrations = registrations.filter(registration => {
    const matchesSearch = 
      registration.tournament_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.captain_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || registration.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const updateRegistrationStatus = async (registrationId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    try {
      await fetch(`/api/registrations/${registrationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })
      
      setRegistrations(registrations.map(reg => 
        reg.id === registrationId ? { ...reg, status: newStatus } : reg
      ))
    } catch (error) {
      console.error('Error updating registration status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'pending': 'bg-yellow-500',
      'approved': 'bg-green-500',
      'rejected': 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'approved':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registrations</CardTitle>
          <CardDescription>Loading tournament registrations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Registrations</CardTitle>
        <CardDescription>
          Manage all tournament registrations ({filteredRegistrations.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by tournament, team, or captain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tournament</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistrations.map((registration) => (
                <TableRow key={registration.id}>
                  <TableCell>
                    <div className="font-medium">{registration.tournament_name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {registration.tournament_id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{registration.team_name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {registration.team_id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>{registration.captain_name}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(registration.status)} text-white`}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(registration.status)}
                        <span>{registration.status}</span>
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(registration.registered_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        
                        {registration.status === 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-green-600"
                              onClick={() => updateRegistrationStatus(registration.id, 'approved')}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve Registration
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => updateRegistrationStatus(registration.id, 'rejected')}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject Registration
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        {registration.status !== 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-yellow-600"
                              onClick={() => updateRegistrationStatus(registration.id, 'pending')}
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              Set to Pending
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredRegistrations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No registrations found matching your filters.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
