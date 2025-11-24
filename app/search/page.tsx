'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUP']

export default function SearchPage() {
  const [searchType, setSearchType] = useState<'players' | 'teams'>('teams')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Mock data
  const mockTeamsLooking = [
    { id: 1, name: 'Shadow Legends', neededRoles: ['MID', 'ADC'], memberCount: 3 },
    { id: 2, name: 'Phoenix Rising', neededRoles: ['SUP'], memberCount: 4 },
  ]

  const mockPlayersLFT = [
    { id: 1, summonerName: 'ShadowKing', role: 'TOP', discord: 'ShadowKing#1234' },
    { id: 3, summonerName: 'SwiftArrow', role: 'ADC', discord: 'Swift#9012' },
    { id: 4, summonerName: 'IceGuard', role: 'SUP', discord: 'Ice#3456' },
  ]

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {searchType === 'teams' ? (
            mockTeamsLooking.map(team => (
              <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition">
                <h3 className="text-2xl font-bold mb-2">{team.name}</h3>
                <p className="text-muted-foreground mb-4">Members: {team.memberCount}/5</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {team.neededRoles.map(role => (
                    <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                      {role}
                    </span>
                  ))}
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90">Apply Now</Button>
              </Card>
            ))
          ) : (
            mockPlayersLFT.map(player => (
              <Card key={player.id} className="bg-card border-border p-6 hover:border-primary transition">
                <h3 className="text-2xl font-bold mb-2">{player.summonerName}</h3>
                <p className="text-primary font-semibold mb-2">{player.role}</p>
                <p className="text-muted-foreground mb-4">Discord: {player.discord}</p>
                <Button className="w-full bg-primary hover:bg-primary/90">Contact Player</Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
