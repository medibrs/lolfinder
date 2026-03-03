import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const createMessageSchema = z.object({
  team_id: z.string().uuid('Invalid team ID'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be under 200 characters'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be under 2000 characters'),
})

// POST /api/admin-messages - Captain sends a message to admins (creates a notification)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { team_id, subject, message } = validation.data

    // Verify the user is the captain of this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .eq('id', team_id)
      .single()

    if (!team || team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only team captains can send admin messages' }, { status: 403 })
    }

    // Get the captain's player profile for display name
    const { data: player } = await supabase
      .from('players')
      .select('summoner_name')
      .eq('id', user.id)
      .single()

    const senderName = player?.summoner_name || 'Unknown Player'

    // Find admin Shams by email
    const { data: { users: adminUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const shams = adminUsers?.find((u) => u.email === 'tiznit.sos@gmail.com')

    if (!shams) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
    }

    // Create a notification for admin Shams only
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: shams.id,
        type: 'admin_message' as const,
        title: `Message from ${senderName} (${team.name})`,
        message: `${subject}: ${message}`,
        read: false,
        data: {
          from_captain: true,
          team_id: team.id,
          team_name: team.name,
          sender_id: user.id,
          sender_name: senderName,
          subject,
        },
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
