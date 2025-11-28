'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

interface RoundRobinBracketProps {
  tournamentId: string
  matches?: any[]
  teams?: any[]
}

export default function RoundRobinBracket({ 
  tournamentId 
}: RoundRobinBracketProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Round Robin Bracket
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Round Robin bracket coming soon</p>
          <p className="text-sm text-zinc-500 mt-2">Everyone plays everyone format</p>
        </div>
      </CardContent>
    </Card>
  )
}
