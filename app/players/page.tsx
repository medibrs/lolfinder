'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

interface Player {
  id: string
  summoner_name: string
  main_role: string
  secondary_role?: string
  opgg_url?: string
  discord?: string
  looking_for_team: boolean
}

export default function PlayersPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching players:', error)
        return
      }

      setPlayers(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPlayers = players.filter(player => {
    const matchesRole = !selectedRole || player.main_role === selectedRole || player.secondary_role === selectedRole
    const matchesSearch = player.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Player Directory</h1>
        <p className="text-muted-foreground mb-8">Browse all registered players looking for teams</p>

        <div className="mb-8 space-y-4">
          <Input
            placeholder="Search by summoner name..."
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map(player => (
                <Card key={player.id} className="bg-card border-border p-6 hover:border-primary transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{player.summoner_name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-semibold">{player.main_role}</span>
                        {player.secondary_role && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">{player.secondary_role}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {player.looking_for_team && (
                      <span 
                        className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-medium cursor-help"
                        title="Looking for team"
                      >
                        LFT
                      </span>
                    )}
                  </div>
                  
                  {player.discord && (
                    <p className="text-muted-foreground mb-4">Discord: {player.discord}</p>
                  )}
                  
                  {player.opgg_url ? (
                    <Button asChild className="w-full bg-primary hover:bg-primary/90">
                      <a href={player.opgg_url} target="_blank" rel="noopener noreferrer">
                        View OP.GG
                      </a>
                    </Button>
                  ) : (
                    <Button disabled className="w-full">
                      No OP.GG Linked
                    </Button>
                  )}
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No players found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
