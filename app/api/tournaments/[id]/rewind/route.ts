import { NextRequest, NextResponse } from 'next/server'
import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'

// POST /api/tournaments/[id]/rewind
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const result = await TournamentOrchestrator.rewindRound(id)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({ message: result.message })
    } catch (error: any) {
        console.error('Error in rewind round:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
