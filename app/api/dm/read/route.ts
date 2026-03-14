import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/dm/read — Mark a conversation as read
 * Body: { conversationId: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { conversationId } = body

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
  }

  // Verify user is part of this conversation
  const { data: convo } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('id', conversationId)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single()

  if (!convo) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Upsert read status
  const { error } = await supabase
    .from('dm_read_status')
    .upsert(
      {
        user_id: user.id,
        conversation_id: conversationId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,conversation_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
