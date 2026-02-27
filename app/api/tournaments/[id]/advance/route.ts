import { NextRequest, NextResponse } from 'next/server'
import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'

// POST /api/tournaments/[id]/advance
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const result = await TournamentOrchestrator.advanceRound(id)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({ message: result.message, data: result.data })
    } catch (error: any) {
        console.error('Error in advance round:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
