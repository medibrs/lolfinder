'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, User, Crown, Trash2, Search, Mail, Calendar, AlertTriangle, MessageSquare, UserX, RefreshCw, X, Bot, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AuthUser {
  id: string
  email: string
  created_at: string
  user_metadata?: any
  app_metadata?: any
  raw_app_meta_data?: any
}

interface UserProfile {
  id: string
  summoner_name: string
  role: string
  tier: string
  created_at: string
  profile_icon_id?: number
}

export default function ComprehensiveUserManagement() {
  const [users, setUsers] = useState<(AuthUser & { profile?: UserProfile & { is_bot?: boolean } })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [excludeBots, setExcludeBots] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [supportTicket, setSupportTicket] = useState({ userId: '', issue: '', resolution: '' })
  const [adminMessage, setAdminMessage] = useState({ userId: '', title: '', message: '' })
  const [messagingUser, setMessagingUser] = useState<AuthUser | null>(null)
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Fetch users from admin API endpoint
      const response = await fetch('/api/admin/users')

      if (!response.ok) {

        return
      }

      const data = await response.json()

      if (data.users) {
        setUsers(data.users.map((user: any) => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          app_metadata: user.app_metadata || {},
          user_metadata: user.user_metadata || {},
          raw_app_meta_data: user.app_metadata || {},
          profile: user.profile
        })))
      }
    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    setUpdating(userId)
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin'

      const response = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role: newRole
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update role')
      }

      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === userId
          ? { ...user, app_metadata: { ...user.app_metadata, role: newRole } }
          : user
      ))
    } catch (error) {

    } finally {
      setUpdating(null)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone and will remove ALL related data including their auth account.')) {
      return
    }

    setDeleting(userId)
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      // Update local state
      setUsers(prev => prev.filter(user => user.id !== userId))
      alert('User deleted successfully.')
    } catch (error: any) {

      alert(`Failed to delete user: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const deleteProfile = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user's profile? This will remove them from their team and delete all profile data, but keep their auth account intact.")) {
      return
    }

    setDeleting(userId)
    try {
      const response = await fetch('/api/admin/delete-profile', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete profile')
      }

      // Update local state to remove profile
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, profile: undefined } : user
      ))

      toast({
        title: "Profile Deleted",
        description: "The user's profile has been completely reset."
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete profile: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setDeleting(null)
    }
  }

  const solveUserProblem = async () => {
    try {
      // Send notification to user
      await supabase
        .from('notifications')
        .insert([{
          user_id: supportTicket.userId,
          type: 'support_resolved',
          title: 'Support Ticket Resolved',
          message: `Your support ticket has been marked as resolved.`,
          data: {
            from: 'admin',
            issue: supportTicket.issue,
            resolution: supportTicket.resolution
          }
        }])

      toast({
        title: "Ticket Resolved",
        description: "User has been notified of the resolution.",
      })

      // Reset form and close dialog
      setSupportTicket({ userId: '', issue: '', resolution: '' })
      setSelectedUser(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resolve ticket",
        variant: "destructive",
      })
    }
  }

  const sendAdminMessage = async () => {
    if (!adminMessage.title.trim() || !adminMessage.message.trim()) {
      toast({
        title: "Error",
        description: "Title and message are required.",
        variant: "destructive",
      })
      return
    }

    try {
      await supabase
        .from('notifications')
        .insert([{
          user_id: adminMessage.userId,
          type: 'admin_message',
          title: adminMessage.title,
          message: adminMessage.message,
          data: {
            from: 'admin'
          }
        }])

      toast({
        title: "Message Sent",
        description: "Your message has been delivered to the user.",
      })

      // Reset form and close dialog
      setAdminMessage({ userId: '', title: '', message: '' })
      setMessagingUser(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile?.summoner_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesBotFilter = !excludeBots || !user.profile?.is_bot
    
    return matchesSearch && matchesBotFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* User Management Header */}
      <div className="flex flex-wrap items-center gap-6 px-4 py-2 bg-slate-900/40 border border-slate-800 rounded-lg text-xs font-bold uppercase tracking-widest mb-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Users</span>
          <span className="text-primary">{users.filter(u => !u.profile?.is_bot).length}</span>
        </div>
        <div className="w-[1px] h-3 bg-slate-800 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Admins</span>
          <span className="text-green-500">{users.filter(u => u.app_metadata?.role === 'admin' && !u.profile?.is_bot).length}</span>
        </div>
        <div className="w-[1px] h-3 bg-slate-800 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Profiles</span>
          <span className="text-blue-500">{users.filter(u => u.profile && !u.profile.is_bot).length}</span>
        </div>
        <div className="w-[1px] h-3 bg-slate-800 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Bots</span>
          <span className="text-orange-500">{users.filter(u => u.profile?.is_bot).length}</span>
        </div>
      </div>

      <Card className="bg-card border-border p-4">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-4 w-4" />
            User Management
          </CardTitle>
        </CardHeader>

        {/* Search Bar - Streamlined */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={excludeBots ? "default" : "outline"}
              size="sm"
              onClick={() => setExcludeBots(!excludeBots)}
              className="h-9 px-3 text-xs flex items-center gap-2"
              title={excludeBots ? "Showing only humans" : "Excluding bots hidden"}
            >
              {excludeBots ? <UserCheck className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              {excludeBots ? "Humans" : "Include Bots"}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => { setLoading(true); fetchUsers() }}
              disabled={loading}
              className="h-9 w-9"
              title="Refresh users"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Users List - Tightened */}
        <div className="space-y-1">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-2 px-3 border border-transparent rounded-md hover:bg-slate-900/50 hover:border-slate-800/50 transition group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 h-8 w-8 relative rounded overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                  {user.profile?.profile_icon_id ? (
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/16.4.1/img/profileicon/${user.profile.profile_icon_id}.png`}
                      alt={user.email}
                      className="object-cover w-full h-full opacity-80 group-hover:opacity-100"
                    />
                  ) : (
                    <User className="h-4 w-4 text-slate-700" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate max-w-[150px] sm:max-w-none text-slate-200">{user.email}</p>
                    {user.profile && (
                      <Badge variant="outline" className={`text-[9px] h-4 py-0 font-mono flex items-center gap-1 ${user.profile.is_bot ? 'border-orange-500/50 text-orange-500 bg-orange-500/5' : 'bg-slate-900/50'}`}>
                        {user.profile.is_bot && <Bot className="h-2.5 w-2.5" />}
                        {user.profile.summoner_name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-tight font-bold text-slate-500">
                    <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {new Date(user.created_at).toLocaleDateString()}</span>
                    {user.profile && (
                      <>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-800" />
                        <span className="text-cyan-600/80">{user.profile.tier || 'Unranked'}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-800" />
                        <span>{user.profile.role}</span>
                      </>
                    )}
                    {!user.profile && (
                      <>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-800" />
                        <span className="text-orange-500 text-[8px]">No profile</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                <Badge
                  variant={user.app_metadata?.role === 'admin' ? 'default' : 'secondary'}
                  className="h-5 px-1.5 text-[9px] uppercase tracking-tighter"
                >
                  {user.app_metadata?.role === 'admin' ? 'ADMIN' : 'USER'}
                </Badge>

                <div className="flex items-center gap-1 border-l border-slate-800 pl-1.5 ml-1">
                  <Dialog
                    open={selectedUser?.id === user.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setSelectedUser(user)
                        setSupportTicket({ userId: user.id, issue: '', resolution: '' })
                      } else {
                        setSelectedUser(null)
                      }
                    }}
                  >
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-200">
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">Support Ticket</TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-md bg-slate-950 border-cyan-900/50 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                      <DialogHeader>
                        <DialogTitle className="text-cyan-100 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-cyan-500" />
                          Support for {user.email}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                          Help resolve user issues and problems
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="issue" className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Issue Description</Label>
                          <Textarea
                            id="issue"
                            placeholder="Describe the user's problem..."
                            value={supportTicket.issue}
                            onChange={(e) => setSupportTicket({ ...supportTicket, issue: e.target.value, userId: user.id })}
                            className="bg-slate-900/50 border-slate-800 focus:border-cyan-500/50 min-h-[100px] resize-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="resolution" className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Resolution</Label>
                          <Textarea
                            id="resolution"
                            placeholder="How was the issue resolved?"
                            value={supportTicket.resolution}
                            onChange={(e) => setSupportTicket({ ...supportTicket, resolution: e.target.value })}
                            className="bg-slate-900/50 border-slate-800 focus:border-cyan-500/50 min-h-[100px] resize-none"
                          />
                        </div>
                        <Button 
                          onClick={solveUserProblem} 
                          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest text-xs h-10 shadow-[0_0_10px_rgba(8,145,178,0.2)]"
                        >
                          Mark as Resolved
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={messagingUser?.id === user.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setMessagingUser(user)
                        setAdminMessage({ userId: user.id, title: '', message: '' })
                      } else {
                        setMessagingUser(null)
                      }
                    }}
                  >
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-200">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">Send Message</TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-md bg-slate-950 border-purple-900/50 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                      <DialogHeader>
                        <DialogTitle className="text-purple-100 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-purple-500" />
                          Message {user.profile?.summoner_name || user.email}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 font-medium">
                          Send a direct administrative message to this user's notification inbox.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="msg-title" className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Title</Label>
                          <Input
                            id="msg-title"
                            placeholder="E.g., Warning, Account Update, etc."
                            value={adminMessage.title}
                            onChange={(e) => setAdminMessage({ ...adminMessage, title: e.target.value, userId: user.id })}
                            className="bg-slate-900/50 border-slate-800 focus:border-purple-500/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="msg-body" className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Message</Label>
                          <Textarea
                            id="msg-body"
                            rows={4}
                            placeholder="Type your message here..."
                            value={adminMessage.message}
                            onChange={(e) => setAdminMessage({ ...adminMessage, message: e.target.value })}
                            className="bg-slate-900/50 border-slate-800 focus:border-purple-500/50 resize-none"
                          />
                        </div>
                        <Button 
                          onClick={sendAdminMessage} 
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs h-10 shadow-[0_0_10px_rgba(147,51,234,0.2)]"
                        >
                          Send Message
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-yellow-500"
                        onClick={() => toggleAdminRole(user.id, user.app_metadata?.role || 'user')}
                        disabled={updating === user.id}
                      >
                        <Crown className={`h-3.5 w-3.5 ${updating === user.id ? 'animate-pulse' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {user.app_metadata?.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </TooltipContent>
                  </Tooltip>

                  {user.profile && (
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-orange-500"
                          onClick={() => deleteProfile(user.id)}
                          disabled={deleting === user.id}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Delete Profile</TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-red-500"
                        onClick={() => deleteUser(user.id)}
                        disabled={deleting === user.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Delete Account</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching "{searchTerm}"
            </div>
          )}
        </div>
      </Card>
    </div>
    </TooltipProvider>
  )
}
