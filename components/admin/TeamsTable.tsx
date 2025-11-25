'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, Users, MessageSquare } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Team {
  id: string
  name: string
  description: string
  captain_id: string
  tier: string
  region: string
  recruiting_status: string
  created_at: string
  member_count?: number
  captain_name?: string
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

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams')
      const data = await response.json()
      
      // Fetch member counts and captain names for each team
      const teamsWithDetails = await Promise.all(
        data.map(async (team: Team) => {
          try {
            const teamResponse = await fetch(`/api/teams/${team.id}`)
            const teamData = await teamResponse.json()
            return {
              ...team,
              member_count: teamData.members?.length || 0,
              captain_name: teamData.captain?.summoner_name || 'Unknown'
            }
          } catch (error) {
            return {
              ...team,
              member_count: 0,
              captain_name: 'Unknown'
            }
          }
        })
      )
      
      setTeams(teamsWithDetails)
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = tierFilter === 'all' || team.tier === tierFilter
    const matchesStatus = statusFilter === 'all' || team.recruiting_status === statusFilter
    
    return matchesSearch && matchesTier && matchesStatus
  })

  const deleteTeam = async (teamId: string) => {
    if (confirm('Are you sure you want to delete this team? This will also remove all team members.')) {
      try {
        await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
        setTeams(teams.filter(t => t.id !== teamId))
      } catch (error) {
        console.error('Error deleting team:', error)
      }
    }
  }

  const openContactDialog = (team: Team) => {
    setSelectedTeam(team)
    setMessageSubject('')
    setMessageContent('')
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
        console.error('Error sending message:', error)
        alert('Failed to send message')
      } else {
        alert('Message sent successfully!')
        setContactDialogOpen(false)
        setMessageSubject('')
        setMessageContent('')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
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
              placeholder="Search by team name or description..."
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
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {team.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                          {team.captain_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
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
              disabled={!messageContent.trim() || sendingMessage}
            >
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
