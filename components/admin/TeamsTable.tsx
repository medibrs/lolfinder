'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Users, MessageSquare, Check, Trophy, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TeamAvatar } from '@/components/ui/team-avatar'

interface Team {
  id: string
  name: string
  captain_id: string
  tier: string
  region: string
  recruiting_status: string
  created_at: string
  member_count?: number
  captain_name?: string
  captain_avatar?: number
  team_avatar?: number
}

interface Tournament {
  id: string
  name: string
  start_date: string
  status: string
}

export default function TeamsTable() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [messageSubject, setMessageSubject] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [addingToTournament, setAddingToTournament] = useState(false)
  const [teamTournaments, setTeamTournaments] = useState<string[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchTeams()
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const response = await fetch('/api/tournaments')
      const data = await response.json()
      setTournaments(data)
    } catch (error) {

    }
  }

  const openTournamentDialog = async (team: Team) => {
    setSelectedTeam(team)
    setSelectedTournamentId('')
    setTournamentDialogOpen(true)
    setLoadingTournaments(true)

    // Fetch which tournaments this team is already registered in
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('tournament_registrations')
        .select('tournament_id')
        .eq('team_id', team.id)
        .in('status', ['pending', 'approved'])

      setTeamTournaments(data?.map(r => r.tournament_id) || [])
    } catch (error) {

    } finally {
      setLoadingTournaments(false)
    }
  }

  const addTeamToTournament = async () => {
    if (!selectedTeam || !selectedTournamentId) return

    setAddingToTournament(true)
    try {
      const supabase = createClient()

      // Check if already registered
      const { data: existing } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('team_id', selectedTeam.id)
        .eq('tournament_id', selectedTournamentId)
        .single()

      if (existing) {

        setAddingToTournament(false)
        return
      }

      // Insert registration directly with approved status
      const { error } = await supabase
        .from('tournament_registrations')
        .insert([{
          team_id: selectedTeam.id,
          tournament_id: selectedTournamentId,
          status: 'approved'
        }])

      if (!error) {
        // Send notification to team captain
        await supabase
          .from('notifications')
          .insert([{
            user_id: selectedTeam.captain_id,
            type: 'tournament_approved',
            title: 'Tournament Registration Approved!',
            message: `Your team "${selectedTeam.name}" has been added to a tournament by an admin!`,
            data: {
              tournament_id: selectedTournamentId,
              team_id: selectedTeam.id,
              from: 'admin'
            }
          }])

        setTeamTournaments([...teamTournaments, selectedTournamentId])
        setSelectedTournamentId('')
        toast({
          title: "Team Registered",
          description: `"${selectedTeam.name}" has been added to the tournament.`,
        })
      } else {

        toast({
          title: "Registration Failed",
          description: "Failed to add team to tournament.",
          variant: "destructive",
        })
      }
    } catch (error) {

    } finally {
      setAddingToTournament(false)
    }
  }

  const removeTeamFromTournament = async (tournamentId: string) => {
    if (!selectedTeam) return

    try {
      const supabase = createClient()
      await supabase
        .from('tournament_registrations')
        .delete()
        .eq('team_id', selectedTeam.id)
        .eq('tournament_id', tournamentId)

      setTeamTournaments(teamTournaments.filter(id => id !== tournamentId))
      toast({
        title: "Team Removed",
        description: "The team has been removed from the tournament.",
      })
    } catch (error) {

      toast({
        title: "Removal Failed",
        description: "Failed to remove team from tournament.",
        variant: "destructive",
      })
    }
  }

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams')
      const result = await response.json()
      const teamsData = Array.isArray(result) ? result : (result.data || [])

      // Fetch member counts and captain names for each team
      const teamsWithDetails = await Promise.all(
        teamsData.map(async (team: Team) => {
          try {
            const teamResponse = await fetch(`/api/teams/${team.id}`)
            const teamData = await teamResponse.json()
            return {
              ...team,
              member_count: teamData.members?.length || 0,
              captain_name: teamData.captain?.summoner_name || 'Unknown',
              captain_avatar: teamData.captain?.profile_icon_id
            }
          } catch (error) {
            return {
              ...team,
              member_count: 0,
              captain_name: 'Unknown',
              captain_avatar: undefined
            }
          }
        })
      )

      setTeams(teamsWithDetails)
    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = tierFilter === 'all' || team.tier === tierFilter
    const matchesStatus = statusFilter === 'all' || team.recruiting_status === statusFilter

    return matchesSearch && matchesTier && matchesStatus
  })

  const deleteTeam = async (teamId: string) => {
    if (confirm('Are you sure you want to delete this team? This will also remove all team members.')) {
      try {
        await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
        setTeams(teams.filter(t => t.id !== teamId))
        toast({
          title: "Team Deleted",
          description: "The team and its members have been removed.",
        })
      } catch (error) {

        toast({
          title: "Delete Failed",
          description: "Failed to delete the team.",
          variant: "destructive",
        })
      }
    }
  }

  const openContactDialog = (team: Team) => {
    setSelectedTeam(team)
    setMessageSubject('')
    setMessageContent('')
    setMessageSent(false)
    setContactDialogOpen(true)
  }

  const sendMessageToCaptain = async () => {
    if (!selectedTeam || !messageContent.trim()) return

    setSendingMessage(true)
    try {
      const supabase = createClient()

      // Create a notification for the team captain
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: selectedTeam.captain_id,
          type: 'admin_message',
          title: messageSubject || 'Message from Admin',
          message: messageContent,
          data: {
            team_id: selectedTeam.id,
            team_name: selectedTeam.name,
            from: 'admin'
          }
        }])

      if (error) {

        toast({
          title: "Message Failed",
          description: "Failed to send notification to team captain.",
          variant: "destructive",
        })
        setSendingMessage(false)
      } else {
        toast({
          title: "Message Sent",
          description: "Notification sent to team captain successfully.",
        })
        setContactDialogOpen(false)
        setMessageSubject('')
        setMessageContent('')
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
      setSendingMessage(false)
    } finally {
      setSendingMessage(false)
    }
  }

  const getTierColor = (tier: string) => {
    const colors: { [key: string]: string } = {
      'Iron': 'bg-gray-500',
      'Bronze': 'bg-orange-700',
      'Silver': 'bg-gray-400',
      'Gold': 'bg-yellow-500',
      'Platinum': 'bg-green-500',
      'Diamond': 'bg-blue-500',
      'Master': 'bg-purple-500',
      'Grandmaster': 'bg-red-500'
    }
    return colors[tier] || 'bg-gray-500'
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Open': 'bg-green-500',
      'Closed': 'bg-red-500',
      'Full': 'bg-blue-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
          <CardDescription>Loading teams...</CardDescription>
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
        <CardTitle>Teams Management</CardTitle>
        <CardDescription>
          Manage all teams on the platform ({filteredTeams.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by team name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="Iron">Iron</SelectItem>
              <SelectItem value="Bronze">Bronze</SelectItem>
              <SelectItem value="Silver">Silver</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
              <SelectItem value="Platinum">Platinum</SelectItem>
              <SelectItem value="Diamond">Diamond</SelectItem>
              <SelectItem value="Master">Master</SelectItem>
              <SelectItem value="Grandmaster">Grandmaster</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
              <SelectItem value="Full">Full</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <TeamAvatar team={team} size="sm" showTooltip={false} />
                      <div className="font-medium">{team.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        {team.captain_avatar ? (
                          <AvatarImage src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${team.captain_avatar}.png`} />
                        ) : null}
                        <AvatarFallback className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 text-xs">
                          {team.captain_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{team.captain_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{team.member_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getTierColor(team.tier)} text-white`}>
                      {team.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>{team.region}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(team.recruiting_status)} text-white`}>
                      {team.recruiting_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(team.created_at).toLocaleDateString()}
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
                          Edit Team
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openContactDialog(team)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Contact Team
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openTournamentDialog(team)}>
                          <Trophy className="mr-2 h-4 w-4" />
                          Manage Tournaments
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteTeam(team.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredTeams.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No teams found matching your filters.
          </div>
        )}
      </CardContent>

      {/* Contact Team Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Contact Team Captain</DialogTitle>
            <DialogDescription>
              Send a message to {selectedTeam?.captain_name || 'the captain'} of {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Message subject (optional)"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={sendMessageToCaptain}
              disabled={!messageContent.trim() || sendingMessage || messageSent}
              className={messageSent ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {sendingMessage ? 'Sending...' : messageSent ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Sent!
                </>
              ) : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tournament Management Dialog */}
      <Dialog open={tournamentDialogOpen} onOpenChange={setTournamentDialogOpen}>
        <DialogContent className="sm:max-w-[501px]">
          <DialogHeader>
            <DialogTitle>Manage Tournament Registration</DialogTitle>
            <DialogDescription>
              Add or remove {selectedTeam?.name} from tournaments
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Current Registrations */}
            <div className="grid gap-2">
              <Label>Current Tournaments</Label>
              {loadingTournaments ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : teamTournaments.length === 0 ? (
                <div className="text-sm text-muted-foreground">Not registered in any tournaments</div>
              ) : (
                <div className="space-y-2">
                  {teamTournaments.map(tournamentId => {
                    const tournament = tournaments.find(t => t.id === tournamentId)
                    return tournament ? (
                      <div key={tournamentId} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">{tournament.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeTeamFromTournament(tournamentId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>

            {/* Add to Tournament */}
            <div className="grid gap-2">
              <Label>Add to Tournament</Label>
              <div className="flex gap-2">
                <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments
                      .filter(t => !teamTournaments.includes(t.id))
                      .map(tournament => (
                        <SelectItem key={tournament.id} value={tournament.id}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={addTeamToTournament}
                  disabled={!selectedTournamentId || addingToTournament}
                >
                  {addingToTournament ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTournamentDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
