'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, ExternalLink, Users, UserX, LayoutList, Group } from 'lucide-react'
import { DDRAGON_VERSION } from '@/lib/ddragon'

interface IntraPlayer {
  id: string
  email: string | null
  intra_login: string | null
  intra_avatar: string | null
  provider: string | null
  summoner_name: string | null
  tier: string | null
  main_role: string | null
  profile_icon_id: number | null
  has_profile: boolean
  team_name: string | null
  team_avatar: string | null
  created_at: string
}

interface TeamGroup {
  team_name: string | null
  players: IntraPlayer[]
}

const getTierColor = (tier: string | null) => {
  if (!tier) return 'bg-gray-600'
  const colors: Record<string, string> = {
    'Iron': 'bg-gray-500',
    'Bronze': 'bg-orange-700',
    'Silver': 'bg-gray-400',
    'Gold': 'bg-yellow-500',
    'Platinum': 'bg-green-500',
    'Emerald': 'bg-emerald-500',
    'Diamond': 'bg-blue-500',
    'Master': 'bg-purple-500',
    'Grandmaster': 'bg-red-500',
    'Challenger': 'bg-cyan-400',
    'Unranked': 'bg-gray-600',
  }
  return colors[tier] || 'bg-gray-600'
}

function PlayerRow({ player }: { player: IntraPlayer }) {
  return (
    <TableRow>
      {/* Intra Login */}
      <TableCell>
        <div className="flex items-center gap-2">
          {player.intra_avatar ? (
            <img
              src={player.intra_avatar}
              alt={player.intra_login || ''}
              className="h-7 w-7 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
              {player.intra_login?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            {player.intra_login ? (
              <a
                href={`https://profile.intra.42.fr/users/${player.intra_login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
              >
                {player.intra_login}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-muted-foreground text-sm italic">
                {player.provider === '42' ? (player.email?.split('@')[0] || 'N/A') : 'Non-42'}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      {/* Summoner Name */}
      <TableCell>
        {player.summoner_name ? (
          <div className="flex items-center gap-2">
            {player.profile_icon_id && (
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${player.profile_icon_id}.png`}
                alt=""
                className="h-6 w-6 rounded-full"
              />
            )}
            <span className="font-medium">{player.summoner_name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm italic">No profile</span>
        )}
      </TableCell>

      {/* Tier */}
      <TableCell>
        {player.tier ? (
          <Badge className={`${getTierColor(player.tier)} text-white text-xs`}>
            {player.tier}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      {/* Profile */}
      <TableCell>
        {player.has_profile ? (
          <Badge variant="default" className="bg-green-600 text-xs">Yes</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">No</Badge>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function IntraPlayersTable() {
  // Flat mode state
  const [players, setPlayers] = useState<IntraPlayer[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Grouped mode state
  const [groups, setGroups] = useState<TeamGroup[]>([])
  const [groupedTotal, setGroupedTotal] = useState(0)

  // Shared state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'flat' | 'team'>('flat')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchFlat = useCallback(async (search: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)

      const response = await fetch(`/api/admin/players-intra?${params}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch')
      }
      const result = await response.json()
      setPlayers(result.players || [])
      setTotalCount(result.totalCount || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGrouped = useCallback(async (search: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ group: 'team' })
      if (search) params.set('search', search)

      const response = await fetch(`/api/admin/players-intra?${params}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch')
      }
      const result = await response.json()
      setGroups(result.groups || [])
      setGroupedTotal(result.totalCount || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mode change or initial load
  useEffect(() => {
    if (viewMode === 'flat') {
      fetchFlat(searchTerm)
    } else {
      fetchGrouped(searchTerm)
    }
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (viewMode === 'flat') {
        fetchFlat(value)
      } else {
        fetchGrouped(value)
      }
    }, 400)
  }

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'flat' ? 'team' : 'flat')
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        <p>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by intra login, summoner name, email, or team..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={viewMode === 'team' ? 'default' : 'outline'}
          size="sm"
          onClick={toggleViewMode}
          className="shrink-0"
        >
          {viewMode === 'team' ? (
            <><LayoutList className="h-4 w-4 mr-1.5" />Flat List</>
          ) : (
            <><Group className="h-4 w-4 mr-1.5" />Group by Team</>
          )}
        </Button>
      </div>

      {/* Info bar */}
      {viewMode === 'flat' && !loading && (
        <div className="text-sm text-muted-foreground">
          {totalCount} users
        </div>
      )}
      {viewMode === 'team' && !loading && (
        <div className="text-sm text-muted-foreground">
          {groupedTotal} users across {groups.filter(g => g.team_name).length} teams
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : viewMode === 'flat' ? (
        /* ─── Flat View ─── */
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>42 Intra Login</TableHead>
                  <TableHead>Summoner Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {player.intra_avatar ? (
                          <img src={player.intra_avatar} alt="" className="h-7 w-7 rounded-full object-cover border border-border" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {player.intra_login?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          {player.intra_login ? (
                            <a href={`https://profile.intra.42.fr/users/${player.intra_login}`} target="_blank" rel="noopener noreferrer"
                              className="font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                              {player.intra_login}<ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">
                              {player.provider === '42' ? (player.email?.split('@')[0] || 'N/A') : 'Non-42'}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {player.summoner_name ? (
                        <div className="flex items-center gap-2">
                          {player.profile_icon_id && (
                            <img src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${player.profile_icon_id}.png`} alt="" className="h-6 w-6 rounded-full" />
                          )}
                          <span className="font-medium">{player.summoner_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">No profile</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {player.team_name ? (
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-green-400" />
                          <span className="text-sm font-medium">{player.team_name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <UserX className="h-3.5 w-3.5" />
                          <span className="text-sm italic">None</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {player.tier ? (
                        <Badge className={`${getTierColor(player.tier)} text-white text-xs`}>{player.tier}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {player.has_profile ? (
                        <Badge variant="default" className="bg-green-600 text-xs">Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(player.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {players.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No users found matching your search.</div>
          )}

        </>
      ) : (
        /* ─── Grouped by Team View ─── */
        <>
          {groups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No users found matching your search.</div>
          )}

          <div className="space-y-6">
            {groups.map((group, idx) => (
              <div key={group.team_name || `no-team-${idx}`} className="rounded-lg border overflow-hidden">
                {/* Team Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/60 border-b">
                  {group.team_name ? (
                    <>
                      <Users className="h-4 w-4 text-green-400" />
                      <span className="font-bold text-sm">{group.team_name}</span>
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-sm text-muted-foreground">No Team</span>
                    </>
                  )}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {group.players.length} {group.players.length === 1 ? 'player' : 'players'}
                  </Badge>
                </div>

                {/* Players Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>42 Intra Login</TableHead>
                      <TableHead>Summoner Name</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Profile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.players.map(player => (
                      <PlayerRow key={player.id} player={player} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
