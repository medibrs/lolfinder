'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUP']

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberRole, setNewMemberRole] = useState('')

  // Mock team data
  const team = {
    id: parseInt(params.id),
    name: 'Shadow Legends',
    owner: 'ShadowKing',
    description: 'Competitive team looking for talented players to join our ranks.',
    founded: 'January 2025',
    lookingFor: true,
    members: [
      { id: 1, name: 'ShadowKing', role: 'TOP', isCaptain: true },
      { id: 2, name: 'FrostMage', role: 'MID', isCaptain: false },
      { id: 3, name: 'SwiftArrow', role: 'ADC', isCaptain: false },
    ],
    neededRoles: ['JNG', 'SUP'],
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <Button asChild variant="outline" className="mb-8">
          <Link href="/teams">← Back to Teams</Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Team Info */}
          <Card className="bg-card border-border p-8 md:col-span-2">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">{team.name}</h1>
              <p className="text-muted-foreground">Owner: {team.owner}</p>
            </div>

            <p className="text-foreground mb-8 leading-relaxed">{team.description}</p>

            <div className="mb-8 p-6 bg-secondary/20 rounded-lg border border-border">
              <p className="text-muted-foreground text-sm mb-2">Team Founded</p>
              <p className="font-semibold">{team.founded}</p>
            </div>

            {/* Needed Roles */}
            {team.lookingFor && (
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">Positions Open</h3>
                <div className="flex flex-wrap gap-3">
                  {team.neededRoles.map(role => (
                    <span key={role} className="bg-accent text-accent-foreground px-4 py-2 rounded-lg font-semibold">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            <div>
              <h3 className="text-xl font-bold mb-4">Team Roster ({team.members.length}/5)</h3>
              <div className="space-y-3">
                {team.members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg border border-border">
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-sm text-primary">{member.role}</p>
                    </div>
                    {member.isCaptain && (
                      <span className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm font-medium">
                        Captain
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card border-border p-6">
              <h3 className="font-bold mb-4">Team Actions</h3>
              <div className="space-y-3">
                <Button onClick={() => setShowAddMember(!showAddMember)} className="w-full bg-primary hover:bg-primary/90">
                  Invite Player
                </Button>
                <Button variant="outline" className="w-full">
                  Edit Team
                </Button>
                <Button variant="outline" className="w-full">
                  Register for Tournament
                </Button>
              </div>
            </Card>

            {showAddMember && (
              <Card className="bg-secondary/20 border-border p-6">
                <h3 className="font-bold mb-4">Invite Player</h3>
                <div className="space-y-3">
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground"
                  >
                    <option value="">Select Role</option>
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Search Players
                  </Button>
                </div>
              </Card>
            )}

            <Card className="bg-secondary/20 border-border p-6">
              <h3 className="font-bold mb-4">Quick Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Members</span>
                  <span className="font-semibold">{team.members.length}/5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-accent font-semibold">Looking for Players</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
