'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LFTGroupCardProps {
  groupType: 'SOLO' | 'DUO'
  players: Array<{ name: string; role: string }>
  lookingFor: string
}

export default function LFTGroupCard({ groupType, players, lookingFor }: LFTGroupCardProps) {
  return (
    <Card className="bg-card border-border p-6 hover:border-primary transition">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold mb-1">{groupType} LFT Group</h3>
          <p className="text-muted-foreground text-sm">{players.length} player(s)</p>
        </div>
        <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-medium">
          {groupType}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {players.map((player, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-primary font-semibold text-sm">{player.role}</span>
            <span className="font-medium">{player.name}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mb-4">Looking for: {lookingFor}</p>

      <Button className="w-full bg-primary hover:bg-primary/90">
        Contact Group
      </Button>
    </Card>
  )
}
