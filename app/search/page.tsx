'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

interface Team {
  id: string
  name: string
  description?: string
  looking_for_players: boolean
  needed_roles: string[]
  created_at: string
}

interface Player {
  id: string
  summoner_name: string
  main_role: string
  secondary_role?: string
  discord?: string
  looking_for_team: boolean
}

export default function SearchPage() {
  const [searchType, setSearchType] = useState<'players' | 'teams'>('teams')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [teamsResult, playersResult] = await Promise.all([
        supabase
          .from('teams')
          .select('*')
          .eq('looking_for_players', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('players')
          .select('*')
          .eq('looking_for_team', true)
          .order('created_at', { ascending: false })
      ])

      if (teamsResult.error) {
        console.error('Error fetching teams:', teamsResult.error)
      } else {
        setTeams(teamsResult.data || [])
      }

      if (playersResult.error) {
        console.error('Error fetching players:', playersResult.error)
      } else {
        setPlayers(playersResult.data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8">Find Your Match</h1>

        <div className="flex gap-4 mb-8">
          <Button
            onClick={() => setSearchType('teams')}
            className={searchType === 'teams' ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/90'}
          >
            Teams Looking for Players
          </Button>
          <Button
            onClick={() => setSearchType('players')}
            className={searchType === 'players' ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/90'}
          >
            Players Looking for Teams
          </Button>
        </div>

        <div className="mb-8 space-y-4">
          <Input
            placeholder={searchType === 'teams' ? 'Search teams...' : 'Search players...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-input border-border"
          />
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedRole === null ? 'default' : 'outline'}
              onClick={() => setSelectedRole(null)}
              className={selectedRole === null ? 'bg-primary' : ''}
            >
              All Roles
            </Button>
            {ROLES.map(role => (
              <Button
                key={role}
                variant={selectedRole === role ? 'default' : 'outline'}
                onClick={() => setSelectedRole(role)}
                className={selectedRole === role ? 'bg-primary' : ''}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searchType === 'teams' ? (
              teams.length > 0 ? (
                teams.filter(team => {
                  const matchesRole = !selectedRole || team.needed_roles.includes(selectedRole)
                  const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
                  return matchesRole && matchesSearch
                }).map(team => (
                  <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition">
                    <h3 className="text-2xl font-bold mb-2">{team.name}</h3>
                    {team.description && (
                      <p className="text-muted-foreground mb-4">{team.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {team.needed_roles.length > 0 ? (
                        team.needed_roles.map(role => (
                          <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Team is full</span>
                      )}
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary/90">Apply Now</Button>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No teams found looking for players.</p>
                </div>
              )
            ) : (
              players.length > 0 ? (
                players.filter(player => {
                  const matchesRole = !selectedRole || player.main_role === selectedRole || player.secondary_role === selectedRole
                  const matchesSearch = player.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())
                  return matchesRole && matchesSearch
                }).map(player => (
                  <Card key={player.id} className="bg-card border-border p-6 hover:border-primary transition">
                    <h3 className="text-2xl font-bold mb-2">{player.summoner_name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-primary font-semibold">{player.main_role}</span>
                      {player.secondary_role && (
                        <>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">{player.secondary_role}</span>
                        </>
                      )}
                    </div>
                    {player.discord && (
                      <p className="text-muted-foreground mb-4">Discord: {player.discord}</p>
                    )}
                    <Button className="w-full bg-primary hover:bg-primary/90">Contact Player</Button>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No players found looking for teams.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  )
}
