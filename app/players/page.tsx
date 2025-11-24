'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUP']

export default function PlayersPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Mock player data
  const mockPlayers = [
    { id: 1, summonerName: 'ShadowKing', role: 'TOP', opggUrl: '#', discord: 'ShadowKing#1234', looking: true },
    { id: 2, summonerName: 'FrostMage', role: 'MID', opggUrl: '#', discord: 'Frost#5678', looking: false },
    { id: 3, summonerName: 'SwiftArrow', role: 'ADC', opggUrl: '#', discord: 'Swift#9012', looking: true },
    { id: 4, summonerName: 'IceGuard', role: 'SUP', opggUrl: '#', discord: 'Ice#3456', looking: true },
    { id: 5, summonerName: 'RazorEdge', role: 'JNG', opggUrl: '#', discord: 'Razor#7890', looking: false },
    { id: 6, summonerName: 'PhoenixRise', role: 'TOP', opggUrl: '#', discord: 'Phoenix#2345', looking: true },
  ]

  const filteredPlayers = mockPlayers.filter(player => {
    const matchesRole = !selectedRole || player.role === selectedRole
    const matchesSearch = player.summonerName.toLowerCase().includes(searchQuery.toLowerCase())
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map(player => (
            <Card key={player.id} className="bg-card border-border p-6 hover:border-primary transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{player.summonerName}</h3>
                  <p className="text-primary font-semibold">{player.role}</p>
                </div>
                {player.looking && (
                  <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-medium">
                    LFT
                  </span>
                )}
              </div>
              
              <p className="text-muted-foreground mb-4">Discord: {player.discord}</p>
              
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <a href={player.opggUrl} target="_blank" rel="noopener noreferrer">
                  View OP.GG
                </a>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
