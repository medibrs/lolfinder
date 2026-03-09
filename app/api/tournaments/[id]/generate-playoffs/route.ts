import { NextRequest, NextResponse } from 'next/server'
import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const result = await TournamentOrchestrator.generatePlayoffs(id)

        return NextResponse.json({
            success: result.success,
            matchIds: result.matchIds,
            eliminated: result.eliminated,
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to generate playoffs' },
            { status: 400 }
        )
    }
}
