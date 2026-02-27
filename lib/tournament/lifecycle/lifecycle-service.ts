/**
 * lifecycle-service.ts — Tournament Lifecycle Persistence
 *
 * The ONLY place that changes tournament.status in the database.
 * Validates transitions via state-machine before writing.
 * Emits events via event-bus after every change.
 */

import { createClient } from '@supabase/supabase-js'
import {
    type TournamentState,
    type TransitionContext,
    validateTransition,
    getCapabilities,
    getValidTransitions,
} from './state-machine'
import { emitEvent, type TournamentEvent } from '../events/event-bus'

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ─── Context Builder ────────────────────────────────────────────────

/**
 * Build transition context from live database state.
 */
async function buildTransitionContext(tournamentId: string): Promise<TransitionContext> {
    const supabase = getServiceClient()

    const [tournamentRes, participantsRes, registrationsRes, bracketsRes, matchesRes] = await Promise.all([
        supabase.from('tournaments').select('current_round, total_rounds, team_size').eq('id', tournamentId).single(),
        supabase.from('tournament_participants').select('id').eq('tournament_id', tournamentId),
        supabase.from('tournament_registrations').select('id').eq('tournament_id', tournamentId).eq('status', 'approved'),
        supabase.from('tournament_brackets').select('id').eq('tournament_id', tournamentId).limit(1),
        supabase.from('tournament_matches').select('id, status').eq('tournament_id', tournamentId).neq('status', 'Completed'),
    ])

    const tournament = tournamentRes.data
    const participants = participantsRes.data || []
    const registrations = registrationsRes.data || []
    const brackets = bracketsRes.data || []
    const incompleteMatches = matchesRes.data || []

    return {
        current_round: tournament?.current_round || 0,
        total_rounds: tournament?.total_rounds || 0,
        registered_teams: registrations.length,
        min_teams: 2,
        has_bracket: brackets.length > 0,
        has_seeding: participants.length > 0,
        incomplete_matches: incompleteMatches.length,
    }
}

// ─── Lifecycle Operations ───────────────────────────────────────────

/**
 * Transition a tournament to a new state.
 * Validates the transition, persists it, and emits an event.
 */
export async function transitionTournament(
    tournamentId: string,
    toState: TournamentState,
    userId?: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = getServiceClient()

    // 1. Load current state
    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('id, status, name')
        .eq('id', tournamentId)
        .single()

    if (fetchError || !tournament) {
        return { success: false, error: 'Tournament not found' }
    }

    const fromState = tournament.status as TournamentState

    // 2. Build context and validate
    const context = await buildTransitionContext(tournamentId)
    const validation = validateTransition(fromState, toState, context)

    if (!validation.allowed) {
        return { success: false, error: validation.reason }
    }

    // 3. Persist state change
    const { error: updateError } = await supabase
        .from('tournaments')
        .update({ status: toState })
        .eq('id', tournamentId)

    if (updateError) {
        return { success: false, error: `Failed to update status: ${updateError.message}` }
    }

    // 4. Emit event
    await emitEvent({
        type: 'TOURNAMENT_STATE_CHANGED',
        tournament_id: tournamentId,
        user_id: userId || null,
        timestamp: new Date().toISOString(),
        payload: {
            from_state: fromState,
            to_state: toState,
            reason: reason || null,
            context,
        },
    })

    return { success: true }
}

/**
 * Get the current state and capabilities for a tournament.
 */
export async function getTournamentLifecycle(tournamentId: string) {
    const supabase = getServiceClient()

    const { data: tournament, error } = await supabase
        .from('tournaments')
        .select('id, status, name')
        .eq('id', tournamentId)
        .single()

    if (error || !tournament) throw new Error('Tournament not found')

    const state = tournament.status as TournamentState
    const capabilities = getCapabilities(state)
    const validTransitions = getValidTransitions(state)

    return {
        state,
        capabilities,
        valid_transitions: validTransitions,
        tournament_name: tournament.name,
    }
}
