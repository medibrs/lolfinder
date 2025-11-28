'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

interface DoubleEliminationBracketProps {
  tournamentId: string
  matches?: any[]
  teams?: any[]
}

export default function DoubleEliminationBracket({ 
  tournamentId 
}: DoubleEliminationBracketProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Double Elimination Bracket
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Double Elimination bracket coming soon</p>
          <p className="text-sm text-zinc-500 mt-2">Winners and losers bracket format</p>
        </div>
      </CardContent>
    </Card>
  )
}
