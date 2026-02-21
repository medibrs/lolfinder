'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2, MessageSquare } from 'lucide-react'
import RoleIcon from '@/components/RoleIcon'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface Player {
  id: string
  summoner_name: string
  discord: string
  main_role: string
  secondary_role: string
  tier: string
  region: string
  looking_for_team: boolean
  created_at: string
}

export default function PlayersTable() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [lftFilter, setLftFilter] = useState('all')

  // Message Dialog State
  const [messageOpen, setMessageOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/players')
      const result = await response.json()
      setPlayers(Array.isArray(result) ? result : (result.data || []))
    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.summoner_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = tierFilter === 'all' || player.tier === tierFilter
    const matchesRole = roleFilter === 'all' || player.main_role === roleFilter || player.secondary_role === roleFilter
    const matchesLft = lftFilter === 'all' ||
      (lftFilter === 'looking' && player.looking_for_team) ||
      (lftFilter === 'not-looking' && !player.looking_for_team)

    return matchesSearch && matchesTier && matchesRole && matchesLft
  })

  const openMessageDialog = (player: Player) => {
    setSelectedPlayer(player)
    setMessageText('')
    setMessageOpen(true)
  }

  const handleSendMessage = async () => {
    if (!selectedPlayer || !messageText.trim()) return

    setSendingMessage(true)
    try {
      // Create a notification for the player using direct client
      // This matches the logic in TeamsTable.tsx which is confirmed to work
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: selectedPlayer.id,
          type: 'admin_message',
          title: 'Message from Admin',
          message: messageText,
          read: false,
          data: {
            from_admin: true
          }
        }])

      if (error) {

        throw error
      }

      setMessageOpen(false)
      toast({
        title: "Message Sent",
        description: `Your message has been sent to ${selectedPlayer.summoner_name}.`,
      })
    } catch (error: any) {

      toast({
        title: "Error Sending Message",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const deletePlayer = async (playerId: string) => {
    if (confirm('Are you sure you want to delete this player? This will remove their account and all related data.')) {
      try {
        const response = await fetch('/api/admin/delete-user', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: playerId })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to delete player')
        }

        setPlayers(players.filter(p => p.id !== playerId))
        toast({
          title: "Player Deleted",
          description: "The player account has been removed.",
        })
      } catch (error: any) {

        toast({
          title: "Deletion Failed",
          description: error.message || "Failed to delete player profile.",
          variant: "destructive",
        })
      }
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
          <CardDescription>Loading players...</CardDescription>
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
        <CardTitle>Players Management</CardTitle>
        <CardDescription>
          Manage all players on the platform ({filteredPlayers.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name..."
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

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="Top">Top</SelectItem>
              <SelectItem value="Jungle">Jungle</SelectItem>
              <SelectItem value="Mid">Mid</SelectItem>
              <SelectItem value="ADC">ADC</SelectItem>
              <SelectItem value="Support">Support</SelectItem>
            </SelectContent>
          </Select>

          <Select value={lftFilter} onValueChange={setLftFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="LFT status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="looking">Looking for Team</SelectItem>
              <SelectItem value="not-looking">Not Looking</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>LFT</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{player.summoner_name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span title={player.main_role}>
                        <RoleIcon role={player.main_role} size={16} className="mr-1" />
                      </span>
                      {player.secondary_role && player.secondary_role !== player.main_role && (
                        <span title={player.secondary_role} className="text-muted-foreground">
                          <RoleIcon role={player.secondary_role} size={16} className="mr-1" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getTierColor(player.tier)} text-white`}>
                      {player.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>{player.region}</TableCell>
                  <TableCell>
                    {player.looking_for_team ? (
                      <Badge
                        variant="default"
                        className="bg-green-500 cursor-help"
                        title="Looking for team"
                      >
                        Yes
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="cursor-help"
                        title="Not looking for team"
                      >
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(player.created_at).toLocaleDateString()}
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
                          Edit Player
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openMessageDialog(player)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Message Player
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deletePlayer(player.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Player
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No players found matching your filters.
          </div>
        )}

        <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message {selectedPlayer?.summoner_name}</DialogTitle>
              <DialogDescription>
                Send a direct notification to this player. They will receive it immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Type your message here..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
              <Button onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim()}>
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
