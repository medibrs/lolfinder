import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    console.log('Fetching participants...')
    const { data: cols } = await supabase.from('tournament_participants').select('team_id, group_id, group_name').limit(2)
    console.log('Sample participants:', JSON.stringify(cols, null, 2))
}

run()
