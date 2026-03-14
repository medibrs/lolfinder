import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/dm/unread — Get unread message counts per conversation
 * Returns: { unreadCounts: { [conversationId]: number }, totalUnread: number }
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all conversations for this user
  const { data: conversations, error: convoError } = await supabase
    .from('dm_conversations')
    .select('id, room_name')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

  if (convoError || !conversations || conversations.length === 0) {
    return NextResponse.json({ unreadCounts: {}, totalUnread: 0 })
  }

  // Get read status for all conversations
  const convoIds = conversations.map(c => c.id)
  const { data: readStatuses } = await supabase
    .from('dm_read_status')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)
    .in('conversation_id', convoIds)

  const readMap = new Map<string, string>()
  for (const rs of (readStatuses || [])) {
    readMap.set(rs.conversation_id, rs.last_read_at)
  }

  // Count unread messages per conversation
  const unreadCounts: Record<string, number> = {}
  let totalUnread = 0

  for (const convo of conversations) {
    const lastReadAt = readMap.get(convo.id)

    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_name', convo.room_name)
      .neq('user_id', user.id)

    if (lastReadAt) {
      query = query.gt('created_at', lastReadAt)
    }

    const { count } = await query

    const unread = count || 0
    if (unread > 0) {
      unreadCounts[convo.id] = unread
      totalUnread += unread
    }
  }

  return NextResponse.json({ unreadCounts, totalUnread })
}
