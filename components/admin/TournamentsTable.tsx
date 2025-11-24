'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Trophy, Calendar, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null)
  const [saving, setSaving] = useState(false)

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
                         (tournament.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const openEditDialog = (tournament: Tournament) => {
    // Ensure all fields have string values (not null)
    setEditingTournament({
      ...tournament,
      description: tournament.description || '',
      prize_pool: tournament.prize_pool || '',
    })
    setEditDialogOpen(true)
  }

  const handleSaveTournament = async () => {
    if (!editingTournament) return

    setSaving(true)
    try {
      const response = await fetch(`/api/tournaments/${editingTournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTournament.name,
          description: editingTournament.description,
          start_date: editingTournament.start_date,
          end_date: editingTournament.end_date,
          prize_pool: editingTournament.prize_pool,
          max_teams: editingTournament.max_teams,
        }),
      })

      if (response.ok) {
        // Refresh tournaments
        await fetchTournaments()
        setEditDialogOpen(false)
        setEditingTournament(null)
      } else {
        const errorData = await response.json()
        console.error('Failed to update tournament:', response.status, errorData)
      }
    } catch (error) {
      console.error('Error updating tournament:', error)
    } finally {
      setSaving(false)
    }
  }

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
                        <DropdownMenuItem onClick={() => openEditDialog(tournament)}>
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

      {/* Edit Tournament Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tournament</DialogTitle>
            <DialogDescription>
              Update tournament details. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          
          {editingTournament && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Tournament Name</Label>
                <Input
                  id="name"
                  value={editingTournament.name}
                  onChange={(e) => setEditingTournament({ ...editingTournament, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingTournament.description}
                  onChange={(e) => setEditingTournament({ ...editingTournament, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={editingTournament.start_date?.slice(0, 16)}
                    onChange={(e) => setEditingTournament({ ...editingTournament, start_date: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={editingTournament.end_date?.slice(0, 16)}
                    onChange={(e) => setEditingTournament({ ...editingTournament, end_date: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prize_pool">Prize Pool</Label>
                  <Input
                    id="prize_pool"
                    value={editingTournament.prize_pool}
                    onChange={(e) => setEditingTournament({ ...editingTournament, prize_pool: e.target.value })}
                    placeholder="e.g., $1,000"
                  />
                </div>
                
                <div>
                  <Label htmlFor="max_teams">Max Teams</Label>
                  <Input
                    id="max_teams"
                    type="number"
                    value={editingTournament.max_teams}
                    onChange={(e) => setEditingTournament({ ...editingTournament, max_teams: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveTournament} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
