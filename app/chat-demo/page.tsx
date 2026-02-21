'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RealtimeChatPersistent } from '@/components/realtime-chat-persistent'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Users, MessageSquare } from 'lucide-react'

export default function ChatDemo() {
  const [roomName, setRoomName] = useState('general')
  const [customRoom, setCustomRoom] = useState('')

  const handleJoinRoom = () => {
    if (customRoom.trim()) {
      setRoomName(customRoom.trim())
      setCustomRoom('')
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Persistent Chat Demo
        </h1>
        <p className="text-muted-foreground">
          Real-time chat with database persistence. Messages are saved and will load when you return.
        </p>
      </div>

      {/* Room Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Chat Room Selection
          </CardTitle>
          <CardDescription>
            Join an existing room or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {['general', 'gaming', 'lolfinder', 'teams', 'tournaments'].map((room) => (
              <Button
                key={room}
                variant={roomName === room ? 'default' : 'outline'}
                onClick={() => setRoomName(room)}
                className="capitalize"
              >
                {room}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Create or join custom room..."
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              maxLength={50}
            />
            <Button onClick={handleJoinRoom} disabled={!customRoom.trim()}>
              Join Room
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Current room: <span className="font-mono bg-muted px-2 py-1 rounded">{roomName}</span>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle>Chat Room: {roomName}</CardTitle>
          <CardDescription>
            Messages are saved permanently and will appear for all users in this room.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[500px] p-0">
          <RealtimeChatPersistent
            roomName={roomName}
            enablePersistence={true}
          />
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>✨ Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>✅ Real-time messaging</div>
            <div>✅ Database persistence</div>
            <div>✅ Message history</div>
            <div>✅ Delete own messages</div>
            <div>✅ Multiple rooms</div>
            <div>✅ User authentication</div>
            <div>✅ Connection status</div>
            <div>✅ Clear room history</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔧 Technical Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Supabase Realtime for live updates</div>
            <div>• PostgreSQL for message storage</div>
            <div>• Row Level Security (RLS)</div>
            <div>• Automatic timestamps</div>
            <div>• Optimized queries with indexes</div>
            <div>• Character limits (1000 chars)</div>
            <div>• Rate limiting ready</div>
            <div>• Mobile responsive</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
