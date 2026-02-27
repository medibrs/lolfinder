/**
 * event-bus.ts — Tournament Event System
 *
 * Every mutation across the entire tournament system emits an event here.
 * Events are persisted to tournament_logs and can optionally trigger
 * background jobs, webhooks, or AI agent tasks in the future.
 *
 * This is NOT optional — it is a first-class system citizen.
 *
 * Usage:
 *   import { emitEvent } from '@/lib/tournament/events/event-bus'
 *
 *   await emitEvent({
 *     type: 'SWISS_DRAFT_CREATED',
 *     tournament_id: '...',
 *     user_id: '...',
 *     timestamp: new Date().toISOString(),
 *     payload: { round: 2, pairings: 8 },
 *   })
 */

import { createClient } from '@supabase/supabase-js'

// ─── Event Types ────────────────────────────────────────────────────

export type EventType =
    // Lifecycle
    | 'TOURNAMENT_STATE_CHANGED'
    | 'TOURNAMENT_CREATED'
    | 'TOURNAMENT_DELETED'
    // Bracket
    | 'BRACKET_GENERATED'
    | 'BRACKET_RESET'
    | 'ROUND_ADVANCED'
    | 'TOURNAMENT_COMPLETED'
    // Swiss
    | 'SWISS_DRAFT_CREATED'
    | 'SWISS_PAIRINGS_APPROVED'
    | 'SWISS_PAIRING_MODIFIED'
    | 'SWISS_ROUND_ADVANCED'
    | 'SWISS_DRAFT_REGENERATED'
    // Match
    | 'MATCH_SCORE_SET'
    | 'MATCH_STATUS_CHANGED'
    | 'MATCH_DISPUTED'
    // Registration
    | 'TEAM_REGISTERED'
    | 'TEAM_UNREGISTERED'
    | 'REGISTRATION_APPROVED'
    | 'REGISTRATION_REJECTED'
    // Seeding
    | 'SEEDING_GENERATED'
    | 'SEEDS_SWAPPED'
    | 'SEEDS_RANDOMIZED'
    | 'SEED_SET'
    // Admin
    | 'ADMIN_OVERRIDE'
    | 'MANUAL_INTERVENTION'

export interface TournamentEvent {
    type: EventType
    tournament_id: string
    user_id: string | null
    timestamp: string
    payload: Record<string, any>
}

// ─── Impact Classification ──────────────────────────────────────────

const IMPACT_MAP: Record<EventType, 'low' | 'medium' | 'high' | 'critical'> = {
    // Lifecycle
    TOURNAMENT_STATE_CHANGED: 'critical',
    TOURNAMENT_CREATED: 'high',
    TOURNAMENT_DELETED: 'critical',
    // Bracket
    BRACKET_GENERATED: 'high',
    BRACKET_RESET: 'critical',
    ROUND_ADVANCED: 'high',
    TOURNAMENT_COMPLETED: 'critical',
    // Swiss
    SWISS_DRAFT_CREATED: 'medium',
    SWISS_PAIRINGS_APPROVED: 'high',
    SWISS_PAIRING_MODIFIED: 'high',
    SWISS_ROUND_ADVANCED: 'high',
    SWISS_DRAFT_REGENERATED: 'medium',
    // Match
    MATCH_SCORE_SET: 'medium',
    MATCH_STATUS_CHANGED: 'medium',
    MATCH_DISPUTED: 'high',
    // Registration
    TEAM_REGISTERED: 'low',
    TEAM_UNREGISTERED: 'low',
    REGISTRATION_APPROVED: 'medium',
    REGISTRATION_REJECTED: 'medium',
    // Seeding
    SEEDING_GENERATED: 'medium',
    SEEDS_SWAPPED: 'low',
    SEEDS_RANDOMIZED: 'medium',
    SEED_SET: 'low',
    // Admin
    ADMIN_OVERRIDE: 'critical',
    MANUAL_INTERVENTION: 'critical',
}

function categorize(type: EventType): string {
    if (type.startsWith('TOURNAMENT_') || type === 'BRACKET_GENERATED' || type === 'BRACKET_RESET') return 'lifecycle'
    if (type.startsWith('SWISS_')) return 'swiss'
    if (type.startsWith('MATCH_')) return 'match'
    if (type.startsWith('ROUND_') || type === 'TOURNAMENT_COMPLETED') return 'bracket'
    if (type.startsWith('TEAM_') || type.startsWith('REGISTRATION_')) return 'registration'
    if (type.startsWith('SEED')) return 'seeding'
    return 'system'
}

// ─── Listeners (Future: Background Jobs, Webhooks) ──────────────────

type EventListener = (event: TournamentEvent) => Promise<void>
const listeners: EventListener[] = []

/**
 * Register a listener for all events.
 * Used for background jobs, webhook dispatch, analytics, etc.
 */
export function onEvent(listener: EventListener): void {
    listeners.push(listener)
}

// ─── Emit ───────────────────────────────────────────────────────────

/**
 * Emit a tournament event.
 * Persists to tournament_logs and notifies all registered listeners.
 */
export async function emitEvent(event: TournamentEvent): Promise<void> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const impact = IMPACT_MAP[event.type] || 'medium'
    const category = categorize(event.type)

    // 1. Persist to tournament_logs
    await supabase.from('tournament_logs').insert({
        tournament_id: event.tournament_id,
        action: event.type,
        details: JSON.stringify(event.payload),
        user_id: event.user_id,
        event_category: category,
        impact_level: impact,
        round_number: event.payload.round_number || event.payload.round || null,
    })

    // 2. Notify listeners (fire-and-forget, don't block the caller)
    for (const listener of listeners) {
        try {
            await listener(event)
        } catch (err) {
            console.error(`[EventBus] Listener error for ${event.type}:`, err)
        }
    }
}

/**
 * Convenience: emit a simple event with minimal payload.
 */
export async function emit(
    type: EventType,
    tournamentId: string,
    payload: Record<string, any> = {},
    userId?: string
): Promise<void> {
    await emitEvent({
        type,
        tournament_id: tournamentId,
        user_id: userId || null,
        timestamp: new Date().toISOString(),
        payload,
    })
}
