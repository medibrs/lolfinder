import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const createMessageSchema = z.object({
  team_id: z.string().uuid('Invalid team ID'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be under 200 characters'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be under 2000 characters'),
})

// GET /api/admin-messages - Get messages for a team (captain) or all messages (admin)
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('team_id')
    const isAdmin = searchParams.get('admin') === 'true'

    // Check if admin
    if (isAdmin) {
      const { data: adminCheck } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!adminCheck) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      // Admin gets all messages, grouped by team
      let query = supabase
        .from('admin_messages')
        .select(`
          *,
          team:teams(id, name, team_avatar),
          sender:players(summoner_name)
        `)
        .order('created_at', { ascending: false })

      if (teamId) {
        query = query.eq('team_id', teamId)
      }

      const { data, error } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(data)
    }

    // Captain: get messages for their team
    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    // Verify the user is the captain of this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, captain_id')
      .eq('id', teamId)
      .single()

    if (!team || team.captain_id !== user.id) {
      return NextResponse.json({ error: 'Only team captains can view admin messages' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin-messages - Send a message (captain or admin)
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

    // Determine sender role
    let senderRole: 'captain' | 'admin'

    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (adminCheck) {
      senderRole = 'admin'
    } else {
      // Verify captain
      const { data: team } = await supabase
        .from('teams')
        .select('id, captain_id')
        .eq('id', team_id)
        .single()

      if (!team || team.captain_id !== user.id) {
        return NextResponse.json({ error: 'Only team captains can send admin messages' }, { status: 403 })
      }

      senderRole = 'captain'
    }

    const { data, error } = await supabase
      .from('admin_messages')
      .insert({
        team_id,
        sender_id: user.id,
        sender_role: senderRole,
        subject,
        message,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin-messages - Mark messages as read  
export async function PATCH(request: NextRequest) {
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
    const { message_ids, team_id } = body

    // Admins can mark any messages read; captains only their team's
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!adminCheck && team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('captain_id')
        .eq('id', team_id)
        .single()

      if (!team || team.captain_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    let query = supabase
      .from('admin_messages')
      .update({ read: true })

    if (message_ids && message_ids.length > 0) {
      query = query.in('id', message_ids)
    } else if (team_id) {
      query = query.eq('team_id', team_id)
      // Captains mark admin messages as read; admins mark captain messages as read
      if (adminCheck) {
        query = query.eq('sender_role', 'captain')
      } else {
        query = query.eq('sender_role', 'admin')
      }
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
