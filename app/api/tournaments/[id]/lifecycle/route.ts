import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    transitionTournament,
    getTournamentLifecycle,
} from '@/lib/tournament/lifecycle/lifecycle-service'
import type { TournamentState } from '@/lib/tournament/lifecycle/state-machine'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resolveTournamentId(id: string): Promise<string | null> {
    const isNumber = /^\d+$/.test(id)
    let query = supabase.from('tournaments').select('id')
    if (isNumber) query = query.eq('tournament_number', parseInt(id))
    else query = query.eq('id', id)
    const { data, error } = await query.single()
    if (error || !data) return null
    return data.id
}

/**
 * GET /api/tournaments/[id]/lifecycle
 * Returns current state, capabilities, and valid transitions.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const tournamentUuid = await resolveTournamentId(id)
        if (!tournamentUuid) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        const lifecycle = await getTournamentLifecycle(tournamentUuid)
        return NextResponse.json(lifecycle)
    } catch (error: any) {
        console.error('Error fetching lifecycle:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/tournaments/[id]/lifecycle
 * Transition to a new state.
 * Body: { to: TournamentState, reason?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const tournamentUuid = await resolveTournamentId(id)
        if (!tournamentUuid) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        const body = await request.json()
        const { to, reason } = body as { to: TournamentState; reason?: string }

        if (!to) {
            return NextResponse.json({ error: '"to" state is required' }, { status: 400 })
        }

        const result = await transitionTournament(tournamentUuid, to, undefined, reason)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        // Return updated lifecycle
        const lifecycle = await getTournamentLifecycle(tournamentUuid)
        return NextResponse.json({ success: true, ...lifecycle })
    } catch (error: any) {
        console.error('Error transitioning lifecycle:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
