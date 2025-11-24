'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUP']

export default function TeamsPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Mock team data
  const mockTeams = [
    { id: 1, name: 'Shadow Legends', owner: 'ShadowKing', looking: true, neededRoles: ['MID', 'ADC'], memberCount: 3 },
    { id: 2, name: 'Frost Dynasty', owner: 'FrostMage', looking: false, neededRoles: [], memberCount: 5 },
    { id: 3, name: 'Phoenix Rising', owner: 'PhoenixRise', looking: true, neededRoles: ['SUP'], memberCount: 4 },
    { id: 4, name: 'Quantum Force', owner: 'VortexDoom', looking: true, neededRoles: ['TOP', 'JNG'], memberCount: 3 },
  ]

  const filteredTeams = mockTeams.filter(team => {
    const matchesRole = !selectedRole || team.neededRoles.includes(selectedRole)
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLooking = team.looking
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTeams.map(team => (
            <Card key={team.id} className="bg-card border-border p-6 hover:border-primary transition">
              <div className="mb-4">
                <h3 className="text-2xl font-bold">{team.name}</h3>
                <p className="text-muted-foreground">Owner: {team.owner}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Members: {team.memberCount}/5</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {team.neededRoles.map(role => (
                    <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-medium">
                      Need {role}
                    </span>
                  ))}
                </div>
              </div>
              
              <Button className="w-full bg-primary hover:bg-primary/90">
                Apply Now
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
