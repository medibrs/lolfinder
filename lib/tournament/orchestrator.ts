/**
 * orchestrator.ts — Format-Agnostic Tournament Orchestrator
 *
 * This is the SINGLE ENTRY POINT for all tournament operations.
 * API routes call this — never the engines or services directly.
 *
 * It dispatches to the correct engine and service based on format.
 *
 * Usage:
 *   import { TournamentOrchestrator } from '@/lib/tournament/orchestrator'
 *
 *   // Generate bracket
 *   const result = await TournamentOrchestrator.generateBracket(tournamentId)
 *
 *   // Advance round
 *   const result = await TournamentOrchestrator.advanceRound(tournamentId, userId)
 */

import { createClient } from '@supabase/supabase-js'
import type {
    TournamentEngine,
    BracketProposal,
    AdvancementResult,
    Advancement,
    CompletedMatch,
    FormatConfig,
} from './engine'
import { SingleEliminationEngine } from './formats/single-elim-core'
import { DoubleEliminationEngine } from './formats/double-elim-core'
import type { SwissProposal, RoundAdvanceResult } from './swiss-core'
import { transitionTournament } from './lifecycle/lifecycle-service'
import {
    loadSwissContext,
    createSwissDraft,
    approveSwissPairings,
    advanceSwissRound,
    regenerateSwissDraft,
} from './swiss-service'

// ─── Engine Registry ────────────────────────────────────────────────

const engines: Record<string, TournamentEngine> = {
    Single_Elimination: SingleEliminationEngine,
    Double_Elimination: DoubleEliminationEngine,
}

function getEngine(format: string): TournamentEngine {
    const engine = engines[format]
    if (!engine) throw new Error(`Unsupported tournament format: ${format}`)
    return engine
}

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ─── Data Loaders ───────────────────────────────────────────────────

async function loadTournament(tournamentId: string) {
    const supabase = getServiceClient()

    // Handle both UUID and tournament_number
    const isNumber = /^\d+$/.test(tournamentId)
    let query = supabase.from('tournaments').select('*')

    if (isNumber) {
        query = query.eq('tournament_number', parseInt(tournamentId))
    } else {
        query = query.eq('id', tournamentId)
    }

    const { data, error } = await query.single()
    if (error || !data) throw new Error('Tournament not found')
    return data
}

async function loadParticipants(tournamentId: string) {
    const supabase = getServiceClient()
    const { data, error } = await supabase
        .from('tournament_participants')
        .select('*, team:teams(id, name, team_avatar)')
        .eq('tournament_id', tournamentId)
        .order('seed_number', { ascending: true })

    if (error) throw new Error(`Failed to load participants: ${error.message}`)
    return data || []
}

async function loadBracketsAndMatches(tournamentId: string) {
    const supabase = getServiceClient()

    const [bracketsRes, matchesRes] = await Promise.all([
        supabase.from('tournament_brackets').select('*').eq('tournament_id', tournamentId),
        supabase.from('tournament_matches')
            .select('*, bracket:tournament_brackets!inner(round_number, bracket_position)')
            .eq('tournament_id', tournamentId),
    ])

    return {
        brackets: bracketsRes.data || [],
        matches: matchesRes.data || [],
    }
}

// ─── Orchestrator ───────────────────────────────────────────────────

export const TournamentOrchestrator = {

    // ────────────────────────────────────────────────────────────────
    // BRACKET GENERATION
    // ────────────────────────────────────────────────────────────────

    /**
     * Generate the initial bracket/pairing structure for a tournament.
     * Dispatches to the correct engine based on format.
     */
    async generateBracket(tournamentId: string): Promise<{
        success: boolean
        data?: any
        error?: string
    }> {
        const supabase = getServiceClient()
        const tournament = await loadTournament(tournamentId)
        const id = tournament.id
        const format = tournament.format || 'Single_Elimination'

        // Check for existing bracket
        const { data: existing } = await supabase
            .from('tournament_brackets')
            .select('id')
            .eq('tournament_id', id)
            .limit(1)

        if (existing && existing.length > 0) {
            return { success: false, error: 'Bracket already exists. Reset first.' }
        }

        const participants = await loadParticipants(id)
        if (participants.length < 2) {
            return { success: false, error: 'Need at least 2 seeded teams' }
        }

        // ── Swiss: uses its own service layer ────────────────────────
        if (format === 'Swiss') {
            const { proposal, pairingIds } = await createSwissDraft(id)
            // Auto-approve round 1 (it doesn't need manual review)
            const { matchIds } = await approveSwissPairings(id, 1)
            return {
                success: true,
                data: { proposal, pairingIds, matchIds, total_rounds: tournament.swiss_rounds || 5 },
            }
        }

        // ── Elimination formats: use engine ─────────────────────────
        const engine = getEngine(format)
        const teams = participants.map((p: any) => ({
            team_id: p.team_id,
            seed_number: p.seed_number,
            team_name: p.team?.name,
        }))

        const config: FormatConfig = {
            opening_best_of: tournament.opening_best_of || 1,
            progression_best_of: tournament.progression_best_of || 3,
            elimination_best_of: tournament.elimination_best_of || 3,
            finals_best_of: tournament.finals_best_of || 5,
        }

        // Generate proposal (pure computation)
        const proposal = engine.generateBracket(teams, config)

        // Validate
        const validation = engine.validate(proposal)
        if (!validation.valid) {
            return { success: false, error: `Invalid bracket: ${validation.errors.join(', ')}` }
        }

        // Persist bracket slots
        const bracketsToInsert = proposal.brackets.map(b => ({
            tournament_id: id,
            round_number: b.round_number,
            bracket_position: b.bracket_position,
            is_final: b.is_final,
            is_third_place: false,
        }))

        const { data: insertedBrackets, error: bracketError } = await supabase
            .from('tournament_brackets')
            .insert(bracketsToInsert)
            .select('*')

        if (bracketError || !insertedBrackets) {
            return { success: false, error: 'Failed to create brackets' }
        }

        // Map bracket IDs to matches
        const bracketIdMap = new Map<string, string>()
        for (const b of insertedBrackets) {
            bracketIdMap.set(`${b.round_number}:${b.bracket_position}`, b.id)
        }

        let matchNumber = 1
        const matchesToInsert = proposal.matches.map(m => ({
            bracket_id: bracketIdMap.get(`${m.round_number}:${m.bracket_position}`)!,
            tournament_id: id,
            match_number: matchNumber++,
            team1_id: m.team1_id,
            team2_id: m.team2_id,
            winner_id: m.winner_id,
            status: m.status,
            result: m.result,
            best_of: m.best_of,
        }))

        const { data: insertedMatches, error: matchError } = await supabase
            .from('tournament_matches')
            .insert(matchesToInsert)
            .select('*')

        if (matchError) {
            return { success: false, error: 'Failed to create matches' }
        }

        // Update tournament state
        await supabase.from('tournaments').update({
            total_rounds: proposal.total_rounds,
            current_round: 1,
        }).eq('id', id)
        await transitionTournament(id, 'In_Progress')

        // Log
        await supabase.from('tournament_logs').insert({
            tournament_id: id,
            action: 'BRACKET_GENERATED',
            details: JSON.stringify({
                format,
                team_count: proposal.metadata.team_count,
                bye_count: proposal.metadata.bye_count,
                total_rounds: proposal.total_rounds,
            }),
            event_category: 'bracket',
            impact_level: 'high',
        })

        return {
            success: true,
            data: { brackets: insertedBrackets, matches: insertedMatches, total_rounds: proposal.total_rounds },
        }
    },

    // ────────────────────────────────────────────────────────────────
    // ROUND ADVANCEMENT
    // ────────────────────────────────────────────────────────────────

    /**
     * Advance a tournament to its next round.
     * Handles all formats uniformly.
     */
    async advanceRound(tournamentId: string, userId?: string): Promise<{
        success: boolean
        message?: string
        data?: any
        error?: string
    }> {
        const supabase = getServiceClient()
        const tournament = await loadTournament(tournamentId)
        const id = tournament.id
        const format = tournament.format || 'Single_Elimination'
        const currentRound = tournament.current_round || 1
        const totalRounds = tournament.total_rounds || 1

        // ── Swiss: delegate to swiss-service ─────────────────────────
        if (format === 'Swiss') {
            const result = await advanceSwissRound(id, userId)
            return {
                success: true,
                message: result.tournament_completed
                    ? 'Tournament completed'
                    : `Round ${currentRound} advanced. Draft pairings generated for round ${currentRound + 1}.`,
                data: result,
            }
        }

        // ── Elimination formats ─────────────────────────────────────
        const { brackets, matches } = await loadBracketsAndMatches(id)

        // Build bracket lookup
        const bracketMap = new Map<string, any>()
        for (const b of brackets) bracketMap.set(b.id, b)

        // Get current round matches
        const roundMatches = matches.filter((m: any) =>
            bracketMap.get(m.bracket_id)?.round_number === currentRound
        )

        // Check all completed
        const incomplete = roundMatches.filter((m: any) => m.status !== 'Completed')
        if (incomplete.length > 0) {
            return {
                success: false,
                error: `${incomplete.length} matches still incomplete in round ${currentRound}`,
            }
        }

        // Compute advancements (pure)
        const engine = getEngine(format)
        const completedMatches: CompletedMatch[] = roundMatches.map((m: any) => ({
            id: m.id,
            bracket_id: m.bracket_id,
            bracket_position: bracketMap.get(m.bracket_id)?.bracket_position || 0,
            round_number: currentRound,
            team1_id: m.team1_id,
            team2_id: m.team2_id,
            winner_id: m.winner_id,
            result: m.result,
            status: m.status,
        }))

        const bracketSlots = brackets.map((b: any) => ({
            round_number: b.round_number,
            bracket_position: b.bracket_position,
            is_final: b.is_final,
        }))

        const advResult = engine.computeAdvancements(
            currentRound, totalRounds, completedMatches, bracketSlots
        )

        // Persist advancements — push winners to next-round match slots
        for (const adv of advResult.advancements) {
            const nextBracket = brackets.find((b: any) =>
                b.round_number === adv.next_round &&
                b.bracket_position === adv.next_bracket_position
            )
            if (!nextBracket) continue

            const nextMatch = matches.find((m: any) => m.bracket_id === nextBracket.id)
            if (!nextMatch) continue

            await supabase
                .from('tournament_matches')
                .update({ [adv.slot]: adv.winner_id })
                .eq('id', nextMatch.id)
        }

        // Update tournament round
        const nextRound = currentRound + 1
        const isCompleted = advResult.tournament_completed

        await supabase.from('tournaments').update({
            current_round: nextRound,
        }).eq('id', id)
        await transitionTournament(id, isCompleted ? 'Completed' : 'In_Progress')

        // Log
        await supabase.from('tournament_logs').insert({
            tournament_id: id,
            action: isCompleted ? 'TOURNAMENT_COMPLETED' : 'ROUND_ADVANCED',
            details: JSON.stringify({
                format,
                round_completed: currentRound,
                next_round: isCompleted ? null : nextRound,
                advancements: advResult.advancements.length,
            }),
            user_id: userId || null,
        })

        return {
            success: true,
            message: isCompleted
                ? 'Tournament completed!'
                : `Advanced to round ${nextRound}`,
            data: advResult,
        }
    },

    // ────────────────────────────────────────────────────────────────
    // BRACKET RESET
    // ────────────────────────────────────────────────────────────────

    /**
     * Full bracket reset — wipes all matches, brackets, and resets participant state.
     */
    async resetBracket(tournamentId: string, userId?: string): Promise<{ success: boolean }> {
        const supabase = getServiceClient()
        const tournament = await loadTournament(tournamentId)
        const id = tournament.id

        await supabase.from('tournament_matches').delete().eq('tournament_id', id)
        await supabase.from('tournament_brackets').delete().eq('tournament_id', id)
        await supabase.from('swiss_pairings').delete().eq('tournament_id', id)
        await supabase.from('tournament_participants')
            .update({ swiss_score: 0, is_active: true })
            .eq('tournament_id', id)
        await supabase.from('tournaments')
            .update({ current_round: 0 })
            .eq('id', id)
        await transitionTournament(id, 'Seeding')

        await supabase.from('tournament_logs').insert({
            tournament_id: id,
            action: 'BRACKET_RESET',
            details: JSON.stringify({ reset_by: userId }),
            user_id: userId || null,
            event_category: 'bracket',
            impact_level: 'critical',
        })

        return { success: true }
    },

    // ────────────────────────────────────────────────────────────────
    // SWISS-SPECIFIC (Draft Lifecycle)
    // ────────────────────────────────────────────────────────────────

    /**
     * Generate a draft pairing proposal for the next Swiss round.
     * Admin can review/edit/approve before matches are created.
     */
    async generateSwissDraft(tournamentId: string, userId?: string) {
        return createSwissDraft(tournamentId, userId)
    },

    /**
     * Approve Swiss pairings → creates matches.
     */
    async approveSwissDraft(tournamentId: string, roundNumber: number, userId?: string) {
        return approveSwissPairings(tournamentId, roundNumber, userId)
    },

    /**
     * Discard and regenerate Swiss draft pairings.
     */
    async regenerateSwissDraft(tournamentId: string, roundNumber: number, userId?: string) {
        return regenerateSwissDraft(tournamentId, roundNumber, userId)
    },
}
