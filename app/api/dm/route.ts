import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Helper: create a deterministic room name from two user IDs
function getDmRoomName(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort()
  return `dm-${sorted[0]}-${sorted[1]}`
}

/**
 * GET /api/dm — List current user's DM conversations
 * Returns conversations with the other user's player info
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all conversations for this user
  const { data: conversations, error } = await supabase
    .from('dm_conversations')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // Get all "other user" IDs so we can fetch their player info
  const otherUserIds = conversations.map(c =>
    c.user1_id === user.id ? c.user2_id : c.user1_id
  )

  // Fetch player data for the other users
  const { data: players } = await supabase
    .from('players')
    .select('id, summoner_name, profile_icon_id, tier, main_role')
    .in('id', otherUserIds)

  const playersMap = new Map((players || []).map(p => [p.id, p]))

  // Fetch last message for each conversation
  const roomNames = conversations.map(c => c.room_name)
  const { data: lastMessages } = await supabase
    .from('chat_messages')
    .select('room_name, content, created_at, user_name')
    .in('room_name', roomNames)
    .order('created_at', { ascending: false })

  // Group by room_name and pick the first (latest) for each
  const lastMessageMap = new Map<string, any>()
  for (const msg of (lastMessages || [])) {
    if (!lastMessageMap.has(msg.room_name)) {
      lastMessageMap.set(msg.room_name, msg)
    }
  }

  // Build response
  const result = conversations.map(c => {
    const otherUserId = c.user1_id === user.id ? c.user2_id : c.user1_id
    const otherPlayer = playersMap.get(otherUserId)
    const lastMsg = lastMessageMap.get(c.room_name)

    return {
      id: c.id,
      roomName: c.room_name,
      otherUser: {
        id: otherUserId,
        summonerName: otherPlayer?.summoner_name || 'Unknown Player',
        profileIconId: otherPlayer?.profile_icon_id || null,
        tier: otherPlayer?.tier || null,
        mainRole: otherPlayer?.main_role || null,
      },
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        createdAt: lastMsg.created_at,
        userName: lastMsg.user_name,
      } : null,
      lastMessageAt: c.last_message_at,
      createdAt: c.created_at,
    }
  })

  return NextResponse.json({ conversations: result })
}

/**
 * POST /api/dm — Create or get an existing DM conversation
 * Body: { otherUserId: string }
 * Returns the conversation with room_name
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { otherUserId } = body

  if (!otherUserId || otherUserId === user.id) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  // Verify the other user exists as a player
  const { data: otherPlayer } = await supabase
    .from('players')
    .select('id, summoner_name, profile_icon_id')
    .eq('id', otherUserId)
    .single()

  if (!otherPlayer) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const roomName = getDmRoomName(user.id, otherUserId)

  // Sort IDs so user1_id is always the smaller one (deterministic)
  const sorted = [user.id, otherUserId].sort()
  const user1Id = sorted[0]
  const user2Id = sorted[1]

  // Check if conversation already exists
  const { data: existing } = await supabase
    .from('dm_conversations')
    .select('*')
    .eq('room_name', roomName)
    .single()

  if (existing) {
    return NextResponse.json({
      conversation: {
        id: existing.id,
        roomName: existing.room_name,
        otherUser: {
          id: otherUserId,
          summonerName: otherPlayer.summoner_name,
          profileIconId: otherPlayer.profile_icon_id,
        },
      },
      created: false,
    })
  }

  // Create new conversation
  const { data: newConvo, error } = await supabase
    .from('dm_conversations')
    .insert({
      user1_id: user1Id,
      user2_id: user2Id,
      room_name: roomName,
    })
    .select()
    .single()

  if (error) {
    // Might be a race condition — try fetching again
    const { data: retryExisting } = await supabase
      .from('dm_conversations')
      .select('*')
      .eq('room_name', roomName)
      .single()

    if (retryExisting) {
      return NextResponse.json({
        conversation: {
          id: retryExisting.id,
          roomName: retryExisting.room_name,
          otherUser: {
            id: otherUserId,
            summonerName: otherPlayer.summoner_name,
            profileIconId: otherPlayer.profile_icon_id,
          },
        },
        created: false,
      })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    conversation: {
      id: newConvo.id,
      roomName: newConvo.room_name,
      otherUser: {
        id: otherUserId,
        summonerName: otherPlayer.summoner_name,
        profileIconId: otherPlayer.profile_icon_id,
      },
    },
    created: true,
  })
}
