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
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Trophy, Calendar, Users, Check, X, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

interface Team {
  id: string
  name: string
  captain_id: string
  member_count?: number
}

interface TournamentRegistration {
  id: string
  team_id: string
  tournament_id: string
  registered_at: string
  status: string
  team: Team
}

export default function TournamentsTable() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null)
  const [saving, setSaving] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [managingTournament, setManagingTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([])
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [loadingRegistrations, setLoadingRegistrations] = useState(false)
  const [selectedTeamToAdd, setSelectedTeamToAdd] = useState<string>('')

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
        const error = await response.json()
        console.error('Failed to update tournament:', response.status, error)
      }
    } catch (error) {
      console.error('Error updating tournament:', error)
    } finally {
      setSaving(false)
    }
  }

  const openManageDialog = async (tournament: Tournament) => {
    setManagingTournament(tournament)
    setManageDialogOpen(true)
    setLoadingRegistrations(true)
    
    try {
      // Fetch registrations for this tournament
      const regResponse = await fetch(`/api/tournaments/${tournament.id}/registrations`)
      const regData = await regResponse.json()
      setRegistrations(regData)

      // Fetch all teams for adding
      const teamsResponse = await fetch('/api/teams')
      const teamsData = await teamsResponse.json()
      setAllTeams(teamsData)
    } catch (error) {
      console.error('Error fetching tournament data:', error)
    } finally {
      setLoadingRegistrations(false)
    }
  }

  const handleAddTeam = async () => {
    if (!managingTournament || !selectedTeamToAdd) return

    try {
      const supabase = createClient()
      
      // Insert registration directly with approved status
      const { error } = await supabase
        .from('tournament_registrations')
        .insert([{
          tournament_id: managingTournament.id,
          team_id: selectedTeamToAdd,
          status: 'approved'
        }])

      if (!error) {
        // Get the team captain ID
        const team = allTeams.find(t => t.id === selectedTeamToAdd)
        if (team) {
          await supabase
            .from('notifications')
            .insert([{
              user_id: team.captain_id,
              type: 'tournament_approved',
              title: 'Tournament Registration Approved!',
              message: `Your team "${team.name}" has been added to ${managingTournament.name} by an admin!`,
              data: {
                tournament_id: managingTournament.id,
                tournament_name: managingTournament.name,
                team_id: team.id,
                from: 'admin'
              }
            }])
        }

        // Refresh registrations
        await openManageDialog(managingTournament)
        setSelectedTeamToAdd('')
      } else {
        console.error('Failed to add team:', error.message)
      }
    } catch (error) {
      console.error('Error adding team:', error)
    }
  }

  const handleUpdateStatus = async (registrationId: string, newStatus: string) => {
    if (!managingTournament) return

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`/api/tournament-registrations/${registrationId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        console.log('Status updated successfully, notification should be sent')
        // Refresh registrations to show updated status
        await openManageDialog(managingTournament)
      } else {
        const error = await response.json()
        console.error('Failed to update status:', error.error)
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleKickTeam = async (registrationId: string) => {
    if (!managingTournament) return

    if (!confirm('Are you sure you want to remove this team from the tournament?')) {
      return
    }

    try {
      const response = await fetch(`/api/tournament-registrations/${registrationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh registrations
        await openManageDialog(managingTournament)
        await fetchTournaments() // Update registration count
      } else {
        const error = await response.json()
        console.error('Failed to kick team:', error.error)
      }
    } catch (error) {
      console.error('Error kicking team:', error)
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
                        <DropdownMenuItem onClick={() => openManageDialog(tournament)}>
                          <Users className="mr-2 h-4 w-4" />
                          Manage Teams
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

      {/* Manage Teams Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Tournament Teams</DialogTitle>
            <DialogDescription>
              {managingTournament?.name} - Add or remove teams from this tournament
            </DialogDescription>
          </DialogHeader>
          
          {loadingRegistrations ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add Team Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-3">Add Team</h3>
                <div className="flex gap-2">
                  <Select value={selectedTeamToAdd} onValueChange={setSelectedTeamToAdd}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a team to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allTeams
                        .filter(team => !registrations.some(reg => reg.team_id === team.id))
                        .map(team => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name} {team.member_count ? `(${team.member_count} members)` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddTeam} disabled={!selectedTeamToAdd}>
                    Add Team
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Registered: {registrations.length} / {managingTournament?.max_teams}
                </p>
              </div>

              {/* Registered Teams List */}
              <div>
                <h3 className="font-semibold mb-3">Registered Teams ({registrations.length})</h3>
                {registrations.length > 0 ? (
                  <div className="space-y-2">
                    {registrations.map((registration) => (
                      <div 
                        key={registration.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{registration.team.name}</span>
                            {registration.status === 'approved' && (
                              <Badge className="bg-green-600"><Check className="h-3 w-3 mr-1" />Approved</Badge>
                            )}
                            {registration.status === 'pending' && (
                              <Badge className="bg-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                            )}
                            {registration.status === 'rejected' && (
                              <Badge className="bg-red-600"><X className="h-3 w-3 mr-1" />Rejected</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Registered: {new Date(registration.registered_at).toLocaleDateString()}
                            {registration.team.member_count && ` • ${registration.team.member_count} members`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={registration.status || 'pending'}
                            onValueChange={(value) => handleUpdateStatus(registration.id, value)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleKickTeam(registration.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    No teams registered yet
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
