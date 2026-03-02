const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/yusuf/lolfinder/.env' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
    // Find latest Swiss tournament
    const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, current_round')
        .eq('format', 'Swiss')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!t) { console.log('No Swiss tournament'); return; }
    console.log('Tournament:', t.name, '| Round:', t.current_round);

    const roundToClean = t.current_round;

    // Find R2 brackets
    const { data: brackets } = await supabase
        .from('tournament_brackets')
        .select('id')
        .eq('tournament_id', t.id)
        .eq('round_number', roundToClean);

    if (!brackets || brackets.length === 0) {
        console.log('No R' + roundToClean + ' brackets to clean');
        return;
    }

    const bracketIds = brackets.map(b => b.id);
    console.log('Found', bracketIds.length, 'R' + roundToClean + ' brackets to delete');

    // Delete R2 matches
    const { error: mErr } = await supabase
        .from('tournament_matches')
        .delete()
        .in('bracket_id', bracketIds);

    if (mErr) { console.log('Error deleting matches:', mErr.message); return; }
    console.log('Deleted R' + roundToClean + ' matches');

    // Delete R2 brackets
    const { error: bErr } = await supabase
        .from('tournament_brackets')
        .delete()
        .in('id', bracketIds);

    if (bErr) { console.log('Error deleting brackets:', bErr.message); return; }
    console.log('Deleted R' + roundToClean + ' brackets');

    // Also clean any stale swiss_pairings drafts
    await supabase
        .from('swiss_pairings')
        .delete()
        .eq('tournament_id', t.id)
        .eq('round_number', roundToClean);

    console.log('Cleaned up R' + roundToClean + ' swiss_pairings');
    console.log('Done! Go to the Seeding tab and click "Generate Matches".');
}

cleanup().catch(console.error);
