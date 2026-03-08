import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resolveTournamentId(id: string): Promise<string | null> {
    const isNumber = /^\d+$/.test(id)
    let query = supabase.from('tournaments').select('id')

    if (isNumber) {
        query = query.eq('tournament_number', parseInt(id))
    } else {
        query = query.eq('id', id)
    }

    const { data, error } = await query.single()
    if (error || !data) return null
    return data.id
}

// POST /api/tournaments/[id]/auto-schedule
// Auto-schedule matches with flexible configuration:
//   - start_hour:        first slot hour (default 10)
//   - matches_per_slot:  concurrent matches per time slot (default 2)
//   - slots_per_day:     number of time slots in a day (default 2)
//   - interval_hours:    gap between consecutive slots (default 1)
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

        // Parse config from body
        const body = await request.json().catch(() => ({}))
        const startHour: number       = body.start_hour        ?? 10
        const matchesPerSlot: number   = body.matches_per_slot  ?? 2
        const slotsPerDay: number      = body.slots_per_day     ?? 2
        const intervalHours: number    = body.interval_hours    ?? 1

        // Validation
        if (startHour < 0 || startHour > 23) {
            return NextResponse.json({ error: 'start_hour must be between 0 and 23' }, { status: 400 })
        }
        if (matchesPerSlot < 1 || matchesPerSlot > 10) {
            return NextResponse.json({ error: 'matches_per_slot must be between 1 and 10' }, { status: 400 })
        }
        if (slotsPerDay < 1 || slotsPerDay > 12) {
            return NextResponse.json({ error: 'slots_per_day must be between 1 and 12' }, { status: 400 })
        }
        if (intervalHours < 1 || intervalHours > 6) {
            return NextResponse.json({ error: 'interval_hours must be between 1 and 6' }, { status: 400 })
        }

        // Get tournament start_date
        const { data: tournament, error: tError } = await supabase
            .from('tournaments')
            .select('id, start_date, name')
            .eq('id', tournamentUuid)
            .single()

        if (tError || !tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        if (!tournament.start_date) {
            return NextResponse.json({ error: 'Tournament has no start_date set' }, { status: 400 })
        }

        // Fetch all matches
        const { data: matches, error: mError } = await supabase
            .from('tournament_matches')
            .select('id, match_number, team1_id, team2_id, bracket_id')
            .eq('tournament_id', tournamentUuid)
            .order('match_number', { ascending: true })

        if (mError) {
            return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
        }

        if (!matches || matches.length === 0) {
            return NextResponse.json({ error: 'No matches found to schedule' }, { status: 400 })
        }

        // Filter out bye matches (no team2)
        const schedulableMatches = matches.filter(m => m.team1_id && m.team2_id)

        if (schedulableMatches.length === 0) {
            return NextResponse.json({ error: 'No valid matches to schedule (all are byes)' }, { status: 400 })
        }

        // Build dynamic time slots for a single day
        // e.g. start_hour=10, slots_per_day=3, interval=2, matches_per_slot=2
        // => slots: [10:00, 10:00, 12:00, 12:00, 14:00, 14:00]
        const daySlots: { hour: number; minute: number }[] = []
        for (let s = 0; s < slotsPerDay; s++) {
            const slotHour = startHour + s * intervalHours
            for (let m = 0; m < matchesPerSlot; m++) {
                daySlots.push({ hour: slotHour, minute: 0 })
            }
        }
        const matchesPerDay = daySlots.length

        const startDate = new Date(tournament.start_date)
        startDate.setHours(0, 0, 0, 0)

        const updates: { id: string; scheduled_at: string }[] = []

        for (let i = 0; i < schedulableMatches.length; i++) {
            const match = schedulableMatches[i]
            const dayIndex = Math.floor(i / matchesPerDay)
            const slotIndex = i % matchesPerDay

            const matchDate = new Date(startDate)
            matchDate.setDate(matchDate.getDate() + dayIndex)
            matchDate.setHours(daySlots[slotIndex].hour, daySlots[slotIndex].minute, 0, 0)

            updates.push({
                id: match.id,
                scheduled_at: matchDate.toISOString(),
            })
        }

        // Batch update
        let successCount = 0
        let errorCount = 0

        for (const update of updates) {
            const { error: uError } = await supabase
                .from('tournament_matches')
                .update({ scheduled_at: update.scheduled_at })
                .eq('id', update.id)

            if (uError) {
                console.error(`Failed to schedule match ${update.id}:`, uError)
                errorCount++
            } else {
                successCount++
            }
        }

        // Log the action
        const totalDays = Math.ceil(schedulableMatches.length / matchesPerDay)
        await supabase.from('tournament_logs').insert({
            tournament_id: tournamentUuid,
            action: 'auto_schedule',
            details: JSON.stringify({
                matches_scheduled: successCount,
                errors: errorCount,
                total_days: totalDays,
                start_date: tournament.start_date,
                config: { startHour, matchesPerSlot, slotsPerDay, intervalHours },
            })
        })

        return NextResponse.json({
            message: `Successfully scheduled ${successCount} matches across ${totalDays} days`,
            scheduled: successCount,
            errors: errorCount,
            total_days: totalDays,
        })
    } catch (error) {
        console.error('Error in auto-schedule:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
