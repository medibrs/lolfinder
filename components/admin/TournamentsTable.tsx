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
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Trophy, Calendar, Users, Check, X, Clock,
  Play, Pause, Square, Settings, Shield, AlertCircle, TrendingUp, BarChart3, Activity,
  Zap, Target, Flag, Award, ChevronRight, Plus, Copy, Download, Upload, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
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
import TournamentManager from '@/components/admin/tournament/TournamentManager'

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
  status?: 'Registration' | 'Registration_Closed' | 'Seeding' | 'In_Progress' | 'Completed' | 'Cancelled'
  format?: 'Single_Elimination' | 'Double_Elimination' | 'Round_Robin' | 'Swiss'
  registration_deadline?: string
  current_round?: number
  total_rounds?: number
  is_active?: boolean
  swiss_rounds?: number
  enable_top_cut?: boolean
  top_cut_size?: number
  tournament_number?: number
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

interface TournamentAdmin {
  id: string
  user_id: string
  role: 'admin' | 'moderator' | 'observer'
  permissions: any
  user?: {
    email: string
    raw_user_meta_data?: any
  }
}

export default function TournamentsTable() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null)
  const [saving, setSaving] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [managingTournament, setManagingTournament] = useState<Tournament | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const { toast } = useToast()

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const response = await fetch('/api/tournaments')
      const data = await response.json()

      // Fetch registration counts and enhanced details for each tournament
      const tournamentsWithDetails = await Promise.all(
        data.map(async (tournament: Tournament) => {
          try {
            const regResponse = await fetch(`/api/tournaments/${tournament.id}/registrations`)
            const registrations = await regResponse.json()

            const now = new Date()
            const startDate = new Date(tournament.start_date)
            const endDate = new Date(tournament.end_date)
            const registrationDeadline = tournament.registration_deadline ? new Date(tournament.registration_deadline) : null

            // Enhanced status logic based on tournament documentation
            let status: Tournament['status'] = 'Registration'
            if (registrationDeadline && now > registrationDeadline) {
              status = 'Registration_Closed'
            }
            if (now >= startDate && now <= endDate) {
              status = tournament.current_round && tournament.current_round > 0 ? 'In_Progress' : 'Seeding'
            }
            if (now > endDate) {
              status = 'Completed'
            }

            const approvedRegistrations = Array.isArray(registrations)
              ? registrations.filter((r: any) => r.status === 'approved')
              : []

            return {
              ...tournament,
              registration_count: approvedRegistrations.length,
              status: tournament.status || status
            }
          } catch (error) {
            return {
              ...tournament,
              registration_count: 0,
              status: tournament.status || 'Registration'
            }
          }
        })
      )

      setTournaments(tournamentsWithDetails)
    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tournament.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter
    const matchesFormat = formatFilter === 'all' || tournament.format === formatFilter

    return matchesSearch && matchesStatus && matchesFormat
  })

  const openEditDialog = (tournament: Tournament) => {
    // Ensure all fields have proper values
    setEditingTournament({
      ...tournament,
      description: tournament.description || '',
      prize_pool: tournament.prize_pool || '',
      format: tournament.format || 'Single_Elimination',
      registration_deadline: tournament.registration_deadline || '',
      current_round: tournament.current_round || 0,
      total_rounds: tournament.total_rounds || 0,
      is_active: tournament.is_active !== false,
      swiss_rounds: tournament.swiss_rounds || 5,
      enable_top_cut: tournament.enable_top_cut || false,
      top_cut_size: tournament.top_cut_size || 8,
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
        body: JSON.stringify(editingTournament),
      })

      if (response.ok) {
        await fetchTournaments()
        setEditDialogOpen(false)
        setEditingTournament(null)
        toast({
          title: "Tournament Updated",
          description: "The tournament settings have been saved successfully.",
        })
      } else {
        const error = await response.json()

        toast({
          title: "Update Failed",
          description: error.message || "Failed to update tournament settings.",
          variant: "destructive",
        })
      }
    } catch (error) {

    } finally {
      setSaving(false)
    }
  }

  const openManageDialog = (tournament: Tournament) => {
    setManagingTournament(tournament)
    setManageDialogOpen(true)
  }

  const deleteTournament = async (tournamentId: string) => {
    if (confirm('Are you sure you want to delete this tournament? This will also delete all registrations, matches, and related data.')) {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' })
        if (response.ok) {
          setTournaments(tournaments.filter(t => t.id !== tournamentId))
          toast({
            title: "Tournament Deleted",
            description: "The tournament has been removed permanentely.",
          })
        } else {
          toast({
            title: "Delete Failed",
            description: "Failed to delete the tournament.",
            variant: "destructive",
          })
        }
      } catch (error) {

        toast({
          title: "Error",
          description: "An unexpected error occurred while deleting.",
          variant: "destructive",
        })
      }
    }
  }

  const duplicateTournament = async (tournament: Tournament) => {
    const newName = prompt(`Enter name for duplicated tournament:`, `${tournament.name} (Copy)`)
    if (!newName) return

    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: tournament.description,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          prize_pool: tournament.prize_pool,
          max_teams: tournament.max_teams,
          format: tournament.format
        }),
      })

      if (response.ok) {
        await fetchTournaments()
        toast({
          title: "Tournament Duplicated",
          description: `Created new tournament: ${newName}`,
        })
      } else {
        toast({
          title: "Duplication Failed",
          description: "Failed to duplicate the tournament.",
          variant: "destructive",
        })
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "An unexpected error occurred while duplicating.",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Registration': 'bg-blue-500',
      'Registration_Closed': 'bg-orange-500',
      'Seeding': 'bg-purple-500',
      'In_Progress': 'bg-green-500',
      'Completed': 'bg-gray-500',
      'Cancelled': 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      'Registration': <Clock className="h-3 w-3" />,
      'Registration_Closed': <X className="h-3 w-3" />,
      'Seeding': <Target className="h-3 w-3" />,
      'In_Progress': <Play className="h-3 w-3" />,
      'Completed': <Trophy className="h-3 w-3" />,
      'Cancelled': <Square className="h-3 w-3" />
    }
    return icons[status] || <Clock className="h-3 w-3" />
  }

  const getFormatIcon = (format: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      'Single_Elimination': <Zap className="h-4 w-4" />,
      'Double_Elimination': <Shield className="h-4 w-4" />,
      'Round_Robin': <RefreshCw className="h-4 w-4" />,
      'Swiss': <BarChart3 className="h-4 w-4" />
    }
    return icons[format] || <Trophy className="h-4 w-4" />
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStats = () => {
    const total = tournaments.length
    const upcoming = tournaments.filter(t => t.status === 'Registration').length
    const inProgress = tournaments.filter(t => t.status === 'In_Progress').length
    const completed = tournaments.filter(t => t.status === 'Completed').length
    const totalRegistrations = tournaments.reduce((sum, t) => sum + (t.registration_count || 0), 0)

    return { total, upcoming, inProgress, completed, totalRegistrations }
  }

  const stats = getStats()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Tournament Management
          </CardTitle>
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
    <div className="space-y-6 p-6">
      {/* Tournament Header */}
      <div className="text-center sm:text-left">
        <div className="text-4xl mb-4">🎮</div>
        <h3 className="text-xl font-bold mb-4">Tournament Management</h3>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total</p>
                <p className="text-lg font-bold text-blue-700">{stats.total}</p>
              </div>
              <Trophy className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Live</p>
                <p className="text-lg font-bold text-green-700">{stats.inProgress}</p>
              </div>
              <Play className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border-indigo-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Upcoming</p>
                <p className="text-lg font-bold text-indigo-700">{stats.upcoming}</p>
              </div>
              <Clock className="h-6 w-6 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-gray-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">Completed</p>
                <p className="text-lg font-bold text-gray-700">{stats.completed}</p>
              </div>
              <Award className="h-6 w-6 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Registrations</p>
                <p className="text-lg font-bold text-purple-700">{stats.totalRegistrations}</p>
              </div>
              <Users className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tournament Table */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Tournament Management
              </CardTitle>
              <CardDescription>
                Manage all tournaments on the platform ({filteredTournaments.length} total)
              </CardDescription>
            </div>
            <Button onClick={() => window.location.search = 'tab=overview'} className="w-full sm:w-auto sm:self-start">
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Enhanced Filters */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Registration">Registration</SelectItem>
                  <SelectItem value="Registration_Closed">Registration Closed</SelectItem>
                  <SelectItem value="Seeding">Seeding</SelectItem>
                  <SelectItem value="In_Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="Single_Elimination">Single Elimination</SelectItem>
                  <SelectItem value="Double_Elimination">Double Elimination</SelectItem>
                  <SelectItem value="Round_Robin">Round Robin</SelectItem>
                  <SelectItem value="Swiss">Swiss</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Tournament</TableHead>
                  <TableHead className="min-w-[120px]">Format</TableHead>
                  <TableHead className="min-w-[150px]">Dates</TableHead>
                  <TableHead className="min-w-[120px]">Prize Pool</TableHead>
                  <TableHead className="min-w-[100px]">Teams</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Progress</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTournaments.map((tournament) => (
                  <TableRow key={tournament.id} className="hover:bg-muted/50">
                    <TableCell className="min-w-[200px]">
                      <a
                        href={`/admin/tournaments/${tournament.tournament_number || tournament.id}`}
                        className="block hover:text-primary transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate max-w-[140px]" title={tournament.name}>
                            {tournament.name}
                          </div>
                          {tournament.tournament_number && (
                            <Badge variant="outline" className="text-xs">#{tournament.tournament_number}</Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {/* <div className="text-sm text-muted-foreground line-clamp-1">
                          {tournament.description}
                        </div> */}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFormatIcon(tournament.format || 'Single_Elimination')}
                        <span className="text-sm">{tournament.format?.replace('_', ' ') || 'Single Elimination'}</span>
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
                        <span className="font-medium">{tournament.prize_pool || 'TBD'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{tournament.registration_count || 0}/{tournament.max_teams}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(tournament.status || 'Registration')} text-white`}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(tournament.status || 'Registration')}
                          {tournament.status?.replace('_', ' ') || 'Registration'}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {tournament.current_round && tournament.total_rounds ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(tournament.current_round / tournament.total_rounds) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {tournament.current_round}/{tournament.total_rounds}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not started</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => window.open(`/tournaments/${tournament.tournament_number || tournament.id}/${tournament.name.toLowerCase().replace(/\s+/g, '-')}`, '_blank')}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Tournament
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openManageDialog(tournament)}>
                            <Users className="mr-2 h-4 w-4" />
                            Manage Teams
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(tournament)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Tournament
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateTournament(tournament)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
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
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No tournaments found matching your filters.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Edit Tournament Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Edit Tournament Settings
            </DialogTitle>
            <DialogDescription>
              Update tournament details, format, and advanced settings.
            </DialogDescription>
          </DialogHeader>

          {editingTournament && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="format">Format Settings</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Tournament Name</Label>
                    <Input
                      id="name"
                      value={editingTournament.name}
                      onChange={(e) => setEditingTournament({ ...editingTournament, name: e.target.value })}
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
                    <Label htmlFor="registration_deadline">Registration Deadline</Label>
                    <Input
                      id="registration_deadline"
                      type="datetime-local"
                      value={editingTournament.registration_deadline?.slice(0, 16)}
                      onChange={(e) => setEditingTournament({ ...editingTournament, registration_deadline: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prize_pool">Prize Pool</Label>
                    <Input
                      id="prize_pool"
                      value={editingTournament.prize_pool}
                      onChange={(e) => setEditingTournament({ ...editingTournament, prize_pool: e.target.value })}
                      placeholder="e.g., $1,000"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="format" className="space-y-4">
                <div>
                  <Label htmlFor="format">Tournament Format</Label>
                  <Select
                    value={editingTournament.format}
                    onValueChange={(value: any) => setEditingTournament({ ...editingTournament, format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single_Elimination">Single Elimination</SelectItem>
                      <SelectItem value="Double_Elimination">Double Elimination</SelectItem>
                      <SelectItem value="Round_Robin">Round Robin</SelectItem>
                      <SelectItem value="Swiss">Swiss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editingTournament.format === 'Swiss' && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-semibold">Swiss Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="swiss_rounds">Number of Rounds</Label>
                        <Input
                          id="swiss_rounds"
                          type="number"
                          value={editingTournament.swiss_rounds}
                          onChange={(e) => setEditingTournament({ ...editingTournament, swiss_rounds: parseInt(e.target.value) })}
                          min="3"
                          max="9"
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Switch
                          id="enable_top_cut"
                          checked={editingTournament.enable_top_cut}
                          onCheckedChange={(checked) => setEditingTournament({ ...editingTournament, enable_top_cut: checked })}
                        />
                        <Label htmlFor="enable_top_cut">Enable Top Cut</Label>
                      </div>
                    </div>
                    {editingTournament.enable_top_cut && (
                      <div>
                        <Label htmlFor="top_cut_size">Top Cut Size</Label>
                        <Input
                          id="top_cut_size"
                          type="number"
                          value={editingTournament.top_cut_size}
                          onChange={(e) => setEditingTournament({ ...editingTournament, top_cut_size: parseInt(e.target.value) })}
                          min="2"
                          max="16"
                        />
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_active">Active Tournament</Label>
                      <p className="text-sm text-muted-foreground">Inactive tournaments won't appear in public listings</p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={editingTournament.is_active}
                      onCheckedChange={(checked) => setEditingTournament({ ...editingTournament, is_active: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="current_round">Current Round</Label>
                      <Input
                        id="current_round"
                        type="number"
                        value={editingTournament.current_round}
                        onChange={(e) => setEditingTournament({ ...editingTournament, current_round: parseInt(e.target.value) })}
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="total_rounds">Total Rounds</Label>
                      <Input
                        id="total_rounds"
                        type="number"
                        value={editingTournament.total_rounds}
                        onChange={(e) => setEditingTournament({ ...editingTournament, total_rounds: parseInt(e.target.value) })}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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

      {/* Enhanced Manage Teams Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] sm:h-[95vh] p-0 overflow-hidden">
          {managingTournament && (
            <TournamentManager
              tournamentId={managingTournament.id}
              onClose={() => setManageDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
