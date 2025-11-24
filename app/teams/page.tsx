'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUP']

interface Team {
  id: string
  name: string
  description?: string
  captain_id: string
  open_positions: string[]
  team_size: string
  recruiting_status: string
  created_at: string
  captain?: {
    summoner_name: string
  }
}

export default function TeamsPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*, captain:players!captain_id(summoner_name)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error:', error)
      } else {
        setTeams(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = teams.filter(team => {
    const matchesRole = !selectedRole || team.open_positions.includes(selectedRole)
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLooking = team.recruiting_status === 'open'
    return matchesRole && matchesSearch && matchesLooking
  })

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Teams</h1>
            <p className="text-muted-foreground">Find teams looking for your role</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <a href="/create-team">Create Team</a>
          </Button>
        </div>

        <div className="mb-8 space-y-4">
          <Input
            placeholder="Search by team name..."
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
            {filteredTeams.length > 0 ? (
              filteredTeams.map(team => (
                <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold">{team.name}</h3>
                    {team.description && (
                      <p className="text-muted-foreground">{team.description}</p>
                    )}
                  </div>
                  
                  {/* Team Info */}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-medium">{team.team_size} players</span>
                      {team.team_size === '6' && (
                        <span className="text-xs text-muted-foreground">(5 + sub)</span>
                      )}
                    </div>
                    {team.captain && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Captain:</span>
                        <span className="font-medium">{team.captain.summoner_name}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Open Positions */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {team.open_positions.length > 0 ? (
                        team.open_positions.map(role => (
                          <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                            Need {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Team is full</span>
                      )}
                    </div>
                  </div>
                  
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Apply Now
                  </Button>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No teams found looking for players.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
