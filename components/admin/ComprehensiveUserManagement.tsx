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
import { Shield, User, Crown, Trash2, Search, Mail, Calendar, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
}

export default function ComprehensiveUserManagement() {
  const [users, setUsers] = useState<(AuthUser & { profile?: UserProfile })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [supportTicket, setSupportTicket] = useState({ userId: '', issue: '', resolution: '' })
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Fetch users from admin API endpoint
      const response = await fetch('/api/admin/users')
      
      if (!response.ok) {
        console.error('Error fetching users:', response.statusText)
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
      console.error('Error:', error)
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
      console.error('Error updating role:', error)
    } finally {
      setUpdating(null)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    setDeleting(userId)
    try {
      // Delete user profile first
      await supabase.from('players').delete().eq('id', userId)
      
      // In real implementation, you'd also delete the auth user via admin API
      
      // Update local state
      setUsers(prev => prev.filter(user => user.id !== userId))
    } catch (error) {
      console.error('Error deleting user:', error)
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
            from: 'admin'
          }
        }])
      
      // Reset form
      setSupportTicket({ userId: '', issue: '', resolution: '' })
    } catch (error) {
      console.error('Error solving problem:', error)
    }
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.profile?.summoner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Management Header */}
      <Card className="bg-card border-border p-6">
        <CardHeader className="p-0 mb-6">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Comprehensive User Management
          </CardTitle>
          <CardDescription>
            Manage users, roles, and support tickets
          </CardDescription>
        </CardHeader>

        {/* Search Bar */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or summoner name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* User Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">{users.length}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="p-4 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {users.filter(u => u.app_metadata?.role === 'admin').length}
            </p>
            <p className="text-sm text-muted-foreground">Admins</p>
          </div>
          <div className="p-4 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">
              {users.filter(u => u.profile).length}
            </p>
            <p className="text-sm text-muted-foreground">With Profiles</p>
          </div>
          <div className="p-4 bg-background rounded-lg text-center">
            <p className="text-2xl font-bold text-orange-600">
              {users.filter(u => !u.profile).length}
            </p>
            <p className="text-sm text-muted-foreground">Need Setup</p>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-background/50 transition"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-full">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">{user.email}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                    {user.profile && (
                      <>
                        <span>•</span>
                        <span>{user.profile.summoner_name}</span>
                        <span>•</span>
                        <span>{user.profile.role}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge 
                  variant={user.app_metadata?.role === 'admin' ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  {user.app_metadata?.role === 'admin' ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {user.app_metadata?.role || 'user'}
                </Badge>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                    >
                      Support
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Support for {user.email}</DialogTitle>
                      <DialogDescription>
                        Help resolve user issues and problems
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="issue">Issue Description</Label>
                        <Textarea
                          id="issue"
                          placeholder="Describe the user's problem..."
                          value={supportTicket.issue}
                          onChange={(e) => setSupportTicket({ ...supportTicket, issue: e.target.value, userId: user.id })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="resolution">Resolution</Label>
                        <Textarea
                          id="resolution"
                          placeholder="How was the issue resolved?"
                          value={supportTicket.resolution}
                          onChange={(e) => setSupportTicket({ ...supportTicket, resolution: e.target.value })}
                        />
                      </div>
                      <Button onClick={solveUserProblem} className="w-full">
                        Mark as Resolved
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAdminRole(user.id, user.app_metadata?.role || 'user')}
                  disabled={updating === user.id}
                >
                  {updating === user.id ? 'Updating...' : 
                   user.app_metadata?.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteUser(user.id)}
                  disabled={deleting === user.id}
                >
                  {deleting === user.id ? 'Deleting...' : (
                    <>
                      <Trash2 className="h-4 w-4" />
                    </>
                  )}
                </Button>
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
  )
}
