'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Trophy, Calendar, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Tournament {
  id: string
  name: string
  description: string
  start_date: string
  end_date: string
  prize_pool: string
  max_teams: number
  created_at: string
  registration_count?: number
  status?: 'upcoming' | 'ongoing' | 'completed'
}

export default function TournamentsTable() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const response = await fetch('/api/tournaments')
      const data = await response.json()
      
      // Fetch registration counts and determine status for each tournament
      const tournamentsWithDetails = await Promise.all(
        data.map(async (tournament: Tournament) => {
          try {
            const regResponse = await fetch(`/api/tournaments/${tournament.id}/registrations`)
            const registrations = await regResponse.json()
            
            const now = new Date()
            const startDate = new Date(tournament.start_date)
            const endDate = new Date(tournament.end_date)
            
            let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming'
            if (now >= startDate && now <= endDate) {
              status = 'ongoing'
            } else if (now > endDate) {
              status = 'completed'
            }
            
            return {
              ...tournament,
              registration_count: registrations.length,
              status
            }
          } catch (error) {
            const now = new Date()
            const startDate = new Date(tournament.start_date)
            const endDate = new Date(tournament.end_date)
            
            let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming'
            if (now >= startDate && now <= endDate) {
              status = 'ongoing'
            } else if (now > endDate) {
              status = 'completed'
            }
            
            return {
              ...tournament,
              registration_count: 0,
              status
            }
          }
        })
      )
      
      setTournaments(tournamentsWithDetails)
    } catch (error) {
      console.error('Error fetching tournaments:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tournament.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const deleteTournament = async (tournamentId: string) => {
    if (confirm('Are you sure you want to delete this tournament? This will also delete all registrations.')) {
      try {
        await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' })
        setTournaments(tournaments.filter(t => t.id !== tournamentId))
      } catch (error) {
        console.error('Error deleting tournament:', error)
      }
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'upcoming': 'bg-blue-500',
      'ongoing': 'bg-green-500',
      'completed': 'bg-gray-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tournaments</CardTitle>
          <CardDescription>Loading tournaments...</CardDescription>
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
        <CardTitle>Tournaments Management</CardTitle>
        <CardDescription>
          Manage all tournaments on the platform ({filteredTournaments.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by tournament name or description..."
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
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tournament</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Prize Pool</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTournaments.map((tournament) => (
                <TableRow key={tournament.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{tournament.name}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {tournament.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div>{formatDate(tournament.start_date)}</div>
                        <div className="text-muted-foreground">to {formatDate(tournament.end_date)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{tournament.prize_pool}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{tournament.registration_count || 0}/{tournament.max_teams}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(tournament.status || 'upcoming')} text-white`}>
                      {tournament.status || 'upcoming'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(tournament.created_at).toLocaleDateString()}
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
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Tournament
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteTournament(tournament.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Tournament
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No tournaments found matching your filters.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
