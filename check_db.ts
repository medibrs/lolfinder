import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    const { data } = await supabase.from('tournaments').select('id, rr_group_count').eq('tournament_number', 8).single()
    console.log('Tournament 8 group count:', data?.rr_group_count)

    // Check how many groups were actually created
    const { data: participants } = await supabase.from('tournament_participants').select('group_id').eq('tournament_id', data?.id)
    const groups = new Set(participants?.map(p => p.group_id))
    console.log('Generated groups for tournament 8:', Array.from(groups))
}

run()
