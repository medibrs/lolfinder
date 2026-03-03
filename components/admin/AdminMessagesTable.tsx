'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, Check, Clock, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CaptainNotification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
  data: {
    from_captain?: boolean
    team_id?: string
    team_name?: string
    sender_id?: string
    sender_name?: string
    subject?: string
  }
}

export default function AdminMessagesTable() {
  const [notifications, setNotifications] = useState<CaptainNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyUserId, setReplyUserId] = useState<string | null>(null)
  const [replyName, setReplyName] = useState('')
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
      if (!session) return

      const response = await fetch('/api/notifications?limit=100', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data: CaptainNotification[] = await response.json()

      // Filter to only captain messages (type = admin_message with from_captain flag)
      const captainMessages = data.filter(
        (n) => n.type === 'admin_message' && n.data?.from_captain === true
      )

      setNotifications(captainMessages)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load captain messages',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (ids: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds: ids }),
      })

      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      )
    } catch {
      // Silently fail
    }
  }

  const handleReply = (senderId: string, senderName: string, teamName: string) => {
    setReplyUserId(senderId)
    setReplyName(`${senderName} (${teamName})`)
    setReplySubject('')
    setReplyMessage('')
    setReplyOpen(true)
  }

  const handleSendReply = async () => {
    if (!replyUserId || !replyMessage.trim()) return

    try {
      setSending(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Use the existing admin send-message endpoint
      const response = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: replyUserId,
          title: replySubject.trim() || 'Reply from Admin',
          message: replyMessage,
        }),
      })

      if (!response.ok) throw new Error('Failed to send reply')

      toast({
        title: 'Reply Sent',
        description: `Message sent to ${replyName}`,
      })

      setReplyOpen(false)
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

  const unreadCount = notifications.filter((n) => !n.read).length

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-900/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No messages yet</p>
        <p className="text-xs text-slate-600 mt-1">
          Team captains can send messages from their manage team page
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {notifications.length} message{notifications.length !== 1 ? 's' : ''}
        </p>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
              {unreadCount} unread
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => handleMarkRead(notifications.filter((n) => !n.read).map((n) => n.id))}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          </div>
        )}
      </div>

      {/* Message list */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`border rounded-lg p-4 transition ${
              notification.read
                ? 'border-slate-800 bg-transparent'
                : 'border-cyan-500/30 bg-cyan-500/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-sm text-slate-200 truncate">
                    {notification.data?.sender_name || 'Captain'}
                  </span>
                  {notification.data?.team_name && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-400">
                      {notification.data.team_name}
                    </Badge>
                  )}
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                  )}
                </div>

                {notification.data?.subject && (
                  <p className="text-xs font-semibold text-slate-300 mb-1">
                    {notification.data.subject}
                  </p>
                )}
                <p className="text-xs text-slate-400 whitespace-pre-wrap">{notification.message}</p>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(notification.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!notification.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-slate-500 hover:text-slate-300"
                    onClick={() => handleMarkRead([notification.id])}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
                {notification.data?.sender_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                    onClick={() =>
                      handleReply(
                        notification.data.sender_id!,
                        notification.data.sender_name || 'Captain',
                        notification.data.team_name || 'Team'
                      )
                    }
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Reply
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reply to {replyName}</DialogTitle>
            <DialogDescription>Send a notification to the captain</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Subject</label>
              <Input
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Reply from Admin"
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
              <p className="text-[10px] text-slate-600 mt-1 text-right">
                {replyMessage.length}/2000
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendReply}
              disabled={sending || !replyMessage.trim()}
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
