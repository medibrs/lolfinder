'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const [registrationType, setRegistrationType] = useState<'complete' | 'looking' | null>(null)
  const [selectedTeam, setSelectedTeam] = useState('')

  // Mock tournament data
  const tournament = {
    id: parseInt(params.id),
    name: 'Spring Circuit 2025',
    status: 'registration-open',
    startDate: 'March 15, 2025',
    endDate: 'April 30, 2025',
    prizePool: '$50,000',
    format: 'Double Elimination',
    teamSlots: 32,
    registeredTeams: 12,
    description: 'The biggest spring tournament of the year. Open registration for teams of all skill levels. Best of 5 series throughout the tournament.',
    rules: [
      'Each team must have exactly 5 players',
      'Players must be at least 16 years old',
      'No roster changes after registration deadline',
      'All matches best of 5',
      'Prize distribution: 1st: $25,000, 2nd: $15,000, 3rd: $10,000'
    ],
    distribution: [
      { place: '1st Place', prize: '$25,000' },
      { place: '2nd Place', prize: '$15,000' },
      { place: '3rd-4th Place', prize: '$10,000' },
    ]
  }

  const mockTeams = [
    { id: 1, name: 'Shadow Legends', memberCount: 5 },
    { id: 2, name: 'Frost Dynasty', memberCount: 5 },
    { id: 3, name: 'Phoenix Rising', memberCount: 4 },
  ]

  const handleRegister = () => {
    if (registrationType === 'complete' && selectedTeam) {
      // API call: POST /tournaments/:id/register/team-complete
      console.log('Registering complete team:', selectedTeam)
    } else if (registrationType === 'looking') {
      // API call: POST /tournaments/:id/register/team-looking
      console.log('Registering team looking for players')
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <Button asChild variant="outline" className="mb-8">
          <Link href="/tournaments">← Back to Tournaments</Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card border-border p-8">
              <div className="mb-6">
                <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
                <p className="text-muted-foreground">{tournament.format} • {tournament.teamSlots} Team Slots</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-secondary/20 rounded-lg border border-border">
                <div>
                  <p className="text-muted-foreground text-sm">Start Date</p>
                  <p className="font-semibold">{tournament.startDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">End Date</p>
                  <p className="font-semibold">{tournament.endDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Prize Pool</p>
                  <p className="font-semibold text-accent">{tournament.prizePool}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Registered</p>
                  <p className="font-semibold">{tournament.registeredTeams}/{tournament.teamSlots}</p>
                </div>
              </div>

              <p className="text-foreground mb-8 leading-relaxed">{tournament.description}</p>

              {/* Prize Distribution */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">Prize Distribution</h3>
                <div className="space-y-2">
                  {tournament.distribution.map((dist, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-secondary/20 rounded border border-border">
                      <span className="font-semibold">{dist.place}</span>
                      <span className="text-accent font-bold">{dist.prize}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules */}
              <div>
                <h3 className="text-xl font-bold mb-4">Tournament Rules</h3>
                <ul className="space-y-2">
                  {tournament.rules.map((rule, idx) => (
                    <li key={idx} className="flex gap-3 text-foreground">
                      <span className="text-primary font-bold">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          {/* Registration Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card border-border p-6 sticky top-24">
              <h3 className="text-xl font-bold mb-4">Tournament Registration</h3>
              
              <div className="space-y-3 mb-6">
                <p className="text-sm text-muted-foreground">
                  Choose how you want to register for this tournament.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setRegistrationType('complete')}
                  variant={registrationType === 'complete' ? 'default' : 'outline'}
                  className={`w-full ${registrationType === 'complete' ? 'bg-primary hover:bg-primary/90' : ''}`}
                >
                  Complete Team
                </Button>
                <Button
                  onClick={() => setRegistrationType('looking')}
                  variant={registrationType === 'looking' ? 'default' : 'outline'}
                  className={`w-full ${registrationType === 'looking' ? 'bg-primary hover:bg-primary/90' : ''}`}
                >
                  Team Looking
                </Button>
              </div>

              {registrationType === 'complete' && (
                <div className="mt-6 pt-6 border-t border-border space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Your Team</label>
                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                    >
                      <option value="">Choose team...</option>
                      {mockTeams.filter(t => t.memberCount === 5).map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={handleRegister} className="w-full bg-primary hover:bg-primary/90" disabled={!selectedTeam}>
                    Register Team
                  </Button>
                </div>
              )}

              {registrationType === 'looking' && (
                <div className="mt-6 pt-6 border-t border-border space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Register your team as looking for players to complete your roster.
                  </p>
                  <Button onClick={handleRegister} className="w-full bg-primary hover:bg-primary/90">
                    Register as Looking
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
