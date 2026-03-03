'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, ChevronDown, ChevronUp, Clock, Shield, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AdminMessage {
  id: string
  team_id: string
  sender_id: string
  sender_role: 'captain' | 'admin'
  subject: string
  message: string
  read: boolean
  created_at: string
  team?: {
    id: string
    name: string
    team_avatar: string | number | null
  }
  sender?: {
    summoner_name: string
  }
}

interface ThreadGroup {
  team_id: string
  team_name: string
  team_avatar: string | number | null
  messages: AdminMessage[]
  unreadCount: number
  lastMessage: AdminMessage
}

export default function AdminMessagesTable() {
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState<ThreadGroup[]>([])
  const [expandedThread, setExpandedThread] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyTeamId, setReplyTeamId] = useState<string | null>(null)
  const [replyTeamName, setReplyTeamName] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [sending, setSending] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/admin-messages?admin=true', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch messages')

      const data: AdminMessage[] = await response.json()
      setMessages(data)

      // Group by team
      const grouped = data.reduce((acc, msg) => {
        const teamId = msg.team_id
        if (!acc[teamId]) {
          acc[teamId] = {
            team_id: teamId,
            team_name: msg.team?.name || 'Unknown Team',
            team_avatar: msg.team?.team_avatar || null,
            messages: [],
            unreadCount: 0,
            lastMessage: msg,
          }
        }
        acc[teamId].messages.push(msg)
        if (!msg.read && msg.sender_role === 'captain') {
          acc[teamId].unreadCount++
        }
        return acc
      }, {} as Record<string, ThreadGroup>)

      // Sort threads by latest message
      const sortedThreads = Object.values(grouped).sort(
        (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      )

      setThreads(sortedThreads)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load admin messages',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (teamId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      await fetch('/api/admin-messages', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team_id: teamId }),
      })

      // Update local state
      setThreads(prev =>
        prev.map(t =>
          t.team_id === teamId
            ? {
                ...t,
                unreadCount: 0,
                messages: t.messages.map(m =>
                  m.sender_role === 'captain' ? { ...m, read: true } : m
                ),
              }
            : t
        )
      )
    } catch (error) {
      // Silently fail
    }
  }

  const handleReply = (teamId: string, teamName: string) => {
    setReplyTeamId(teamId)
    setReplyTeamName(teamName)
    setReplySubject('')
    setReplyMessage('')
    setReplyOpen(true)
  }

  const handleSendReply = async () => {
    if (!replyTeamId || !replySubject.trim() || !replyMessage.trim()) return

    try {
      setSending(true)
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/admin-messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: replyTeamId,
          subject: replySubject,
          message: replyMessage,
        }),
      })

      if (!response.ok) throw new Error('Failed to send reply')

      toast({
        title: 'Reply Sent',
        description: `Message sent to ${replyTeamName}`,
      })

      setReplyOpen(false)
      fetchMessages()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reply',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const toggleThread = (teamId: string) => {
    if (expandedThread === teamId) {
      setExpandedThread(null)
    } else {
      setExpandedThread(teamId)
      handleMarkRead(teamId)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 1) return `${Math.floor(diffMs / (1000 * 60))}m ago`
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
    if (diffHours < 48) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-900/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No messages yet</p>
        <p className="text-xs text-slate-600 mt-1">Team captains can send messages from their manage team page</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {threads.length} conversation{threads.length !== 1 ? 's' : ''}
        </p>
        {totalUnread > 0 && (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
            {totalUnread} unread
          </Badge>
        )}
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {threads.map(thread => (
          <div key={thread.team_id} className="border border-slate-800 rounded-lg overflow-hidden">
            {/* Thread header */}
            <button
              onClick={() => toggleThread(thread.team_id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-900/50 transition text-left"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                {thread.team_avatar ? (
                  <img
                    src={getTeamAvatarUrl(thread.team_avatar) || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-200 truncate">{thread.team_name}</span>
                  {thread.unreadCount > 0 && (
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] px-1.5 py-0">
                      {thread.unreadCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {thread.lastMessage.sender_role === 'admin' ? 'You: ' : ''}
                  {thread.lastMessage.subject}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-slate-600">{formatDate(thread.lastMessage.created_at)}</span>
                {expandedThread === thread.team_id ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </button>

            {/* Expanded messages */}
            {expandedThread === thread.team_id && (
              <div className="border-t border-slate-800">
                <div className="max-h-96 overflow-y-auto p-3 space-y-3">
                  {thread.messages
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.sender_role === 'admin'
                              ? 'bg-cyan-500/10 border border-cyan-500/20'
                              : 'bg-slate-900/80 border border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {msg.sender_role === 'admin' ? (
                              <Shield className="w-3 h-3 text-cyan-400" />
                            ) : (
                              <Users className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {msg.sender_role === 'admin' ? 'Admin' : msg.sender?.summoner_name || 'Captain'}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-300 mb-1">{msg.subject}</p>
                          <p className="text-xs text-slate-400 whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Reply button */}
                <div className="p-3 border-t border-slate-800">
                  <Button
                    onClick={() => handleReply(thread.team_id, thread.team_name)}
                    size="sm"
                    className="w-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20"
                  >
                    <Send className="w-3 h-3 mr-2" />
                    Reply to {thread.team_name}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reply to {replyTeamName}</DialogTitle>
            <DialogDescription>
              Send a message to the team captain
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Subject</label>
              <Input
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Message subject"
                maxLength={200}
                className="bg-slate-900/50 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Message</label>
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                maxLength={2000}
                rows={5}
                className="bg-slate-900/50 border-slate-700 resize-none"
              />
              <p className="text-[10px] text-slate-600 mt-1 text-right">{replyMessage.length}/2000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSendReply}
              disabled={sending || !replySubject.trim() || !replyMessage.trim()}
              className="bg-[#C89B3C] hover:bg-[#A67E22] text-zinc-900 font-bold"
            >
              {sending ? 'Sending...' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
