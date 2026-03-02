const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/yusuf/lolfinder/.env' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, format, current_round, status')
        .eq('format', 'Swiss')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!t) { console.log('No Swiss tournament'); return; }
    console.log('Tournament:', t.name, '| Round:', t.current_round, '| Status:', t.status);

    // Load brackets separately
    const { data: brackets } = await supabase
        .from('tournament_brackets')
        .select('id, round_number, bracket_position')
        .eq('tournament_id', t.id);

    const bracketMap = {};
    for (const b of (brackets || [])) bracketMap[b.id] = b;

    // Load matches
    const { data: matches, error: mErr } = await supabase
        .from('tournament_matches')
        .select('id, bracket_id, team1_id, team2_id, status, result, winner_id, match_number, team1_score, team2_score')
        .eq('tournament_id', t.id);

    if (mErr) { console.log('Match query error:', mErr.message); return; }

    // Load participants
    const { data: parts } = await supabase
        .from('tournament_participants')
        .select('team_id, seed_number, swiss_score, is_active, team:teams(name)')
        .eq('tournament_id', t.id)
        .order('seed_number');

    const names = {};
    for (const p of (parts || [])) names[p.team_id] = p.team?.name || p.team_id.slice(0, 8);

    console.log('\n--- MATCHES (' + (matches || []).length + ') ---');
    for (const m of (matches || []).sort((a, b) => {
        const ra = bracketMap[a.bracket_id]?.round_number || 0;
        const rb = bracketMap[b.bracket_id]?.round_number || 0;
        return ra - rb || a.match_number - b.match_number;
    })) {
        const r = bracketMap[m.bracket_id]?.round_number || '?';
        console.log(
            'R' + r, 'M' + m.match_number + ':',
            (names[m.team1_id] || '?') + '(s:' + m.team1_score + ')',
            'vs',
            (names[m.team2_id] || '?') + '(s:' + m.team2_score + ')',
            '| status=' + m.status,
            '| result=' + m.result,
            '| winner=' + (m.winner_id ? names[m.winner_id] : 'none')
        );
    }

    console.log('\n--- PARTICIPANTS ---');
    for (const p of (parts || [])) {
        console.log(
            'Seed', p.seed_number + ':',
            (p.team?.name || '?'),
            '| swiss_score=' + p.swiss_score,
            '| active=' + p.is_active
        );
    }
}

check().catch(console.error);
