import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const TEAM_ADJECTIVES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Sigma', 'Omega', 'Nova', 'Apex', 'Hyper']
const TEAM_NOUNS = ['Wolves', 'Dragons', 'Knights', 'Phoenix', 'Titans', 'Vipers', 'Storm', 'Legends', 'Hawks', 'Lions', 'Foxes', 'Bears', 'Sharks', 'Falcons', 'Ravens', 'Cobras']
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster']

export async function POST() {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
            return NextResponse.json({ error: 'Service role key not configured.' }, { status: 500 })
        }

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Generate a unique team name
        const adj = TEAM_ADJECTIVES[Math.floor(Math.random() * TEAM_ADJECTIVES.length)]
        const noun = TEAM_NOUNS[Math.floor(Math.random() * TEAM_NOUNS.length)]
        const suffix = Math.floor(Math.random() * 900) + 100
        const teamName = `${adj} ${noun} ${suffix}`
        const tier = TIERS[Math.floor(Math.random() * TIERS.length)]

        // Create 5 bot players
        const playerIds: string[] = []
        for (let j = 0; j < 5; j++) {
            const uid = `${Date.now()}_${j}_${Math.floor(Math.random() * 9999)}`
            const email = `bot_${uid}@example.com`
            const name = `Bot_${uid}`

            const { data: newUser, error: authErr } = await adminClient.auth.admin.createUser({
                email,
                password: 'BotPass123!',
                email_confirm: true,
                user_metadata: { name }
            })
            if (authErr) throw new Error(`Auth: ${authErr.message}`)

            const { error: profileErr } = await adminClient.from('players').insert({
                id: newUser.user.id,
                summoner_name: `${name}#BOT`,
                summoner_level: Math.floor(Math.random() * 200) + 30,
                profile_icon_id: Math.floor(Math.random() * 28) + 1,
                tier,
                rank: ['I', 'II', 'III', 'IV'][Math.floor(Math.random() * 4)],
                league_points: Math.floor(Math.random() * 100),
                wins: Math.floor(Math.random() * 150) + 10,
                losses: Math.floor(Math.random() * 150) + 10,
                main_role: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'][j],
                secondary_role: ['Mid', 'Top', 'ADC', 'Support', 'Jungle'][j],
                looking_for_team: false,
            })
            if (profileErr) throw new Error(`Profile: ${profileErr.message}`)

            playerIds.push(newUser.user.id)
        }

        // Create team
        const { data: team, error: teamErr } = await adminClient.from('teams').insert({
            name: teamName,
            captain_id: playerIds[0],
            recruiting_status: 'Closed',
            description: 'Demo team for testing',
        }).select().single()
        if (teamErr) throw new Error(`Team: ${teamErr.message}`)

        // Assign players to team
        await adminClient.from('players').update({ team_id: team.id }).in('id', playerIds)

        return NextResponse.json({
            success: true,
            team: { name: teamName, id: team.id, members: 5, tier },
            message: `Created "${teamName}" with 5 players!`
        })
    } catch (error: any) {
        console.error('[Bot Gen]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
