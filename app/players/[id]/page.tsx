'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  // Mock player data - would come from API
  const player = {
    id: parseInt(params.id),
    summonerName: 'ShadowKing',
    mainRole: 'TOP',
    secondaryRole: 'JNG',
    discord: 'ShadowKing#1234',
    opggUrl: 'https://op.gg/summoners/na/ShadowKing',
    joinedDate: 'January 2025',
    status: 'Looking for Team',
    stats: {
      wins: 245,
      losses: 189,
      winrate: '56.5%',
      tier: 'Platinum II',
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <Button asChild variant="outline" className="mb-8">
          <Link href="/players">← Back to Players</Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Profile Card */}
          <Card className="bg-card border-border p-8 md:col-span-2">
            <div className="mb-8">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-4xl font-bold mb-2">{player.summonerName}</h1>
                  <p className="text-primary font-semibold text-lg">{player.stats.tier}</p>
                </div>
                <span className="bg-accent text-accent-foreground px-4 py-2 rounded-lg font-semibold">
                  {player.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 p-6 bg-secondary/20 rounded-lg border border-border">
              <div>
                <p className="text-muted-foreground text-sm">Main Role</p>
                <p className="text-xl font-bold text-primary">{player.mainRole}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Secondary Role</p>
                <p className="text-xl font-bold text-primary">{player.secondaryRole}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Win Rate</p>
                <p className="text-xl font-bold text-accent">{player.stats.winrate}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">W/L</p>
                <p className="text-xl font-bold">{player.stats.wins}W - {player.stats.losses}L</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground text-sm mb-2">Discord</p>
                <p className="font-mono font-semibold">{player.discord}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-2">Member Since</p>
                <p>{player.joinedDate}</p>
              </div>
            </div>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card border-border p-6">
              <h3 className="font-bold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button asChild className="w-full bg-primary hover:bg-primary/90">
                  <a href={player.opggUrl} target="_blank" rel="noopener noreferrer">
                    View OP.GG
                  </a>
                </Button>
                <Button variant="outline" className="w-full">
                  Contact via Discord
                </Button>
                <Button variant="outline" className="w-full">
                  Invite to Team
                </Button>
              </div>
            </Card>

            <Card className="bg-secondary/20 border-border p-6">
              <h3 className="font-bold mb-4">About This Player</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Experienced top laner looking for a competitive team for upcoming tournaments. Available for scrimmages and matches.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
