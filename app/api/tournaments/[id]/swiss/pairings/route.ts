
import { NextResponse } from 'next/server'
import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params

  try {
    const { proposal, pairingIds } = await TournamentOrchestrator.generateSwissDraft(tournamentId)
    const { matchIds } = await TournamentOrchestrator.approveSwissDraft(tournamentId, proposal.round)

    return NextResponse.json({
      success: true,
      matches: matchIds.length,
      round: proposal.round,
      rematches_forced: proposal.metadata.rematches_forced,
    })
  } catch (error: any) {
    console.error('Pairing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
