import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin =
      user.app_metadata?.role === 'admin' ||
      user.email === 'tiznit.sos@gmail.com'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const search = request.nextUrl.searchParams.get('search') || ''
    const groupMode = request.nextUrl.searchParams.get('group') || ''

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch all auth users (paginated by Supabase in batches of 1000)
    const allAuthUsers: any[] = []
    let authPage = 1
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: authPage, perPage: 1000 })
      if (error) return NextResponse.json({ error: 'Failed to fetch auth users' }, { status: 500 })
      allAuthUsers.push(...(data.users || []))
      if ((data.users || []).length < 1000) break
      authPage++
    }

    // Fetch real players, real teams, and bot player IDs in parallel
    const [playersRes, teamsRes, botPlayersRes] = await Promise.all([
      adminClient.from('players').select('id, summoner_name, team_id, tier, main_role, profile_icon_id').or('is_bot.is.null,is_bot.eq.false'),
      adminClient.from('teams').select('id, name, team_avatar').or('is_bot.is.null,is_bot.eq.false'),
      adminClient.from('players').select('id').eq('is_bot', true),
    ])

    if (playersRes.error) return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    if (teamsRes.error) return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })

    const teamsMap = new Map((teamsRes.data || []).map(t => [t.id, t]))
    const playersMap = new Map((playersRes.data || []).map(p => [p.id, p]))
    const botPlayerIds = new Set((botPlayersRes.data || []).map(b => b.id))

    // Build merged list (exclude bot player auth users)
    let result = allAuthUsers.filter(u => !botPlayerIds.has(u.id)).map(authUser => {
      const player = playersMap.get(authUser.id)
      const team = player?.team_id ? teamsMap.get(player.team_id) : null
      const meta = authUser.user_metadata || {}

      let intraLogin = meta.intra_login || null
      if (!intraLogin && meta.provider === '42' && authUser.email) {
        intraLogin = authUser.email.split('@')[0]
      }

      return {
        id: authUser.id,
        email: authUser.email || null,
        intra_login: intraLogin,
        intra_avatar: meta.intra_avatar || null,
        provider: meta.provider || null,
        summoner_name: player?.summoner_name || null,
        tier: player?.tier || null,
        main_role: player?.main_role || null,
        profile_icon_id: player?.profile_icon_id || null,
        has_profile: !!player,
        team_name: team?.name || null,
        team_avatar: team?.team_avatar || null,
        created_at: authUser.created_at,
      }
    })

    // Sort: intra_login first, then alphabetically
    result.sort((a, b) => {
      if (a.intra_login && !b.intra_login) return -1
      if (!a.intra_login && b.intra_login) return 1
      if (a.intra_login && b.intra_login) return a.intra_login.localeCompare(b.intra_login)
      return 0
    })

    // Server-side search filter
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(p =>
        (p.intra_login && p.intra_login.toLowerCase().includes(s)) ||
        (p.summoner_name && p.summoner_name.toLowerCase().includes(s)) ||
        (p.email && p.email.toLowerCase().includes(s)) ||
        (p.team_name && p.team_name.toLowerCase().includes(s))
      )
    }

    // Group by team mode
    if (groupMode === 'team') {
      const grouped: Record<string, typeof result> = {}
      for (const p of result) {
        const key = p.team_name || '__no_team__'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(p)
      }

      // Build sorted array of groups: teams first (alphabetical), then "No Team" last
      const teams = Object.keys(grouped)
        .filter(k => k !== '__no_team__')
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({ team_name: name, players: grouped[name] }))

      if (grouped['__no_team__']) {
        teams.push({ team_name: null as any, players: grouped['__no_team__'] })
      }

      return NextResponse.json({ groups: teams, totalCount: result.length })
    }

    return NextResponse.json({
      players: result,
      totalCount: result.length,
    })
  } catch (error) {
    console.error('Error in players-intra route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
