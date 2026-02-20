import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
    const { data: tourneys } = await supabase.from('tournaments').select('id').limit(1);
    if (!tourneys || tourneys.length === 0) return console.log('no tourneys');

    const id = tourneys[0].id;
    const { data: matches, error } = await supabase
        .from('tournament_matches')
        .select(`
        *,
        bracket:tournament_brackets(round_number, is_final),
        team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
        team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar),
        winner:teams!tournament_matches_winner_id_fkey(id, name)
      `)
        .eq('tournament_id', id)
        .order('match_number', { ascending: true });

    console.log(JSON.stringify(matches?.[0] || error, null, 2));
}

test();
