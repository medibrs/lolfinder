'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/players')
      const data = await response.json()
      setPlayers(data)
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.summoner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.discord.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = tierFilter === 'all' || player.tier === tierFilter
    const matchesRole = roleFilter === 'all' || player.main_role === roleFilter || player.secondary_role === roleFilter
    const matchesLft = lftFilter === 'all' || 
                      (lftFilter === 'looking' && player.looking_for_team) ||
                      (lftFilter === 'not-looking' && !player.looking_for_team)
    
    return matchesSearch && matchesTier && matchesRole && matchesLft
  })

  const deletePlayer = async (playerId: string) => {
    if (confirm('Are you sure you want to delete this player?')) {
      try {
        await fetch(`/api/players/${playerId}`, { method: 'DELETE' })
        setPlayers(players.filter(p => p.id !== playerId))
      } catch (error) {
        console.error('Error deleting player:', error)
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

  const getRoleIcon = (role: string) => {
    const icons: { [key: string]: string } = {
      'Top': '🛡️',
      'Jungle': '🌳',
      'Mid': '✨',
      'ADC': '🏹',
      'Support': '💙'
    }
    return icons[role] || '❓'
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
              placeholder="Search by name or Discord..."
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
                      <div className="text-sm text-muted-foreground">{player.discord}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span title={player.main_role}>{getRoleIcon(player.main_role)}</span>
                      {player.secondary_role && player.secondary_role !== player.main_role && (
                        <span title={player.secondary_role} className="text-muted-foreground">
                          {getRoleIcon(player.secondary_role)}
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
      </CardContent>
    </Card>
  )
}
