/**
 * state-machine.ts — Tournament Lifecycle State Machine
 *
 * Defines ALL valid tournament states and their legal transitions.
 * This is the ONLY place where state transition rules live.
 *
 * RULES:
 *   ❌ NO database imports
 *   ❌ NO side effects
 *   ✅ Pure validation only
 */

// ─── States ─────────────────────────────────────────────────────────

export type TournamentState =
    | 'Registration'    // Accepting team sign-ups
    | 'Seeding'         // Registrations closed, admin arranging seeds
    | 'In_Progress'     // Bracket generated, matches being played
    | 'Paused'          // Temporarily halted (admin decision)
    | 'Completed'       // All rounds finished, results final
    | 'Cancelled'       // Terminated early (no results)
    | 'Archived'        // Historical record, fully locked

export const ALL_STATES: TournamentState[] = [
    'Registration', 'Seeding', 'In_Progress', 'Paused',
    'Completed', 'Cancelled', 'Archived',
]

// ─── Transition Map ─────────────────────────────────────────────────

/**
 * Legal state transitions. Key = current state, value = allowed next states.
 * Any transition NOT in this map is illegal and will be rejected.
 */
const TRANSITIONS: Record<TournamentState, TournamentState[]> = {
    Registration: ['Seeding', 'Cancelled'],
    Seeding: ['In_Progress', 'Registration', 'Cancelled'],
    In_Progress: ['Paused', 'Completed', 'Cancelled'],
    Paused: ['In_Progress', 'Cancelled'],
    Completed: ['Archived'],
    Cancelled: ['Archived', 'Registration'],  // Allow revival
    Archived: [],                             // Terminal state
}

// ─── Guard Conditions ───────────────────────────────────────────────

/**
 * Context provided to guard checks before allowing a transition.
 */
export interface TransitionContext {
    current_round: number
    total_rounds: number
    registered_teams: number
    min_teams: number
    has_bracket: boolean
    has_seeding: boolean
    incomplete_matches: number
}

/**
 * Guards that must pass for specific transitions.
 * Returns an error string if the guard fails, null if it passes.
 */
type Guard = (ctx: TransitionContext) => string | null

const GUARDS: Partial<Record<string, Guard>> = {
    // Registration → Seeding: need minimum teams
    'Registration->Seeding': (ctx) => {
        if (ctx.registered_teams < ctx.min_teams) {
            return `Need at least ${ctx.min_teams} teams (have ${ctx.registered_teams})`
        }
        return null
    },

    // Seeding → In_Progress: need seeding to exist
    'Seeding->In_Progress': (ctx) => {
        if (!ctx.has_seeding) return 'Seeding must be generated first'
        return null
    },

    // In_Progress → Completed: all matches must be done
    'In_Progress->Completed': (ctx) => {
        if (ctx.incomplete_matches > 0) {
            return `${ctx.incomplete_matches} matches still incomplete`
        }
        return null
    },
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Check if a state transition is structurally valid (ignoring guards).
 */
export function isValidTransition(
    from: TournamentState,
    to: TournamentState
): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get all valid next states from the current state.
 */
export function getValidTransitions(from: TournamentState): TournamentState[] {
    return TRANSITIONS[from] || []
}

/**
 * Validate a transition including guard checks.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function validateTransition(
    from: TournamentState,
    to: TournamentState,
    context: TransitionContext
): { allowed: boolean; reason?: string } {
    // 1. Check structural validity
    if (!isValidTransition(from, to)) {
        return {
            allowed: false,
            reason: `Transition from '${from}' to '${to}' is not allowed. Valid transitions: [${getValidTransitions(from).join(', ')}]`,
        }
    }

    // 2. Check guard conditions
    const guardKey = `${from}->${to}`
    const guard = GUARDS[guardKey]
    if (guard) {
        const error = guard(context)
        if (error) return { allowed: false, reason: error }
    }

    return { allowed: true }
}

// ─── State Properties ───────────────────────────────────────────────

/**
 * What actions are allowed in each state.
 * Used by API routes and UI to enable/disable features.
 */
export interface StateCapabilities {
    can_register: boolean
    can_edit_seeding: boolean
    can_generate_bracket: boolean
    can_play_matches: boolean
    can_advance_round: boolean
    can_modify_pairings: boolean
    is_mutable: boolean       // Any tournament data can change
    is_terminal: boolean      // No further state transitions possible
}

const CAPABILITIES: Record<TournamentState, StateCapabilities> = {
    Registration: {
        can_register: true,
        can_edit_seeding: true,  // Admin can generate and edit seeding while registration is open
        can_generate_bracket: false,
        can_play_matches: false,
        can_advance_round: false,
        can_modify_pairings: false,
        is_mutable: true,
        is_terminal: false,
    },
    Seeding: {
        can_register: false,
        can_edit_seeding: true,
        can_generate_bracket: true,
        can_play_matches: false,
        can_advance_round: false,
        can_modify_pairings: false,
        is_mutable: true,
        is_terminal: false,
    },
    In_Progress: {
        can_register: false,
        can_edit_seeding: true,  // Admin can still edit seeding during tournament
        can_generate_bracket: false,
        can_play_matches: true,
        can_advance_round: true,
        can_modify_pairings: true,
        is_mutable: true,
        is_terminal: false,
    },
    Paused: {
        can_register: false,
        can_edit_seeding: true,
        can_generate_bracket: false,
        can_play_matches: false,
        can_advance_round: false,
        can_modify_pairings: true,
        is_mutable: true,
        is_terminal: false,
    },
    Completed: {
        can_register: false,
        can_edit_seeding: false,
        can_generate_bracket: false,
        can_play_matches: false,
        can_advance_round: false,
        can_modify_pairings: false,
        is_mutable: false,
        is_terminal: false,
    },
    Cancelled: {
        can_register: false,
        can_edit_seeding: false,
        can_generate_bracket: false,
        can_play_matches: false,
        can_advance_round: false,
        can_modify_pairings: false,
        is_mutable: false,
        is_terminal: false,
    },
    Archived: {
        can_register: false,
        can_edit_seeding: false,
        can_generate_bracket: false,
        can_play_matches: false,
        can_advance_round: false,
        can_modify_pairings: false,
        is_mutable: false,
        is_terminal: true,
    },
}

export function getCapabilities(state: TournamentState): StateCapabilities {
    return CAPABILITIES[state]
}
