'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Settings, User, Shield, Trash2, Bell, Eye, EyeOff } from 'lucide-react'
import NotificationToggle from '@/components/NotificationToggle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notificationManager, NotificationOptions } from '@/lib/browser-notifications'
import { faviconBadge } from '@/lib/favicon-badge'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [supabase])



  /* 
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long')
      return
    }

    setPasswordLoading(true)
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      if (response.ok) {
        setPasswordSuccess('Password updated successfully!')
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setShowPasswordForm(false)
      } else {
        const error = await response.json()
        setPasswordError(error.error || 'Failed to update password')
      }
    } catch (error) {
      setPasswordError('Failed to update password')
    } finally {
      setPasswordLoading(false)
    }
  }
  */

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone and will remove all your data including teams, tournaments, and notifications.')) {
      return
    }

    setDeleteLoading(true)
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || 'Account deleted successfully.')
        router.push('/')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete account. Please contact support.')
      }
    } catch (error) {

      alert('Failed to delete account. Please contact support.')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth')
    return null
  }

  return (
    <div className="min-h-screen pt-20 pb-8 sm:pt-24 sm:pb-12">
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Notification Settings */}
          <Card className="w-full">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Control how you receive notifications about tournaments and team activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium">Browser Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Get instant updates in your browser when you're online
                  </p>
                </div>
                <div className="w-full sm:w-auto">
                  <NotificationToggle />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-blue-800 dark:text-blue-200 font-semibold text-sm mb-1">Why Enable Notifications?</h4>
                    <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
                      <li>• Get notified about new tournament registrations</li>
                      <li>• Receive team invitations instantly</li>
                      <li>• Stay updated on tournament announcements</li>
                      <li>• Never miss important messages from admins</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card className="w-full">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Your account details and information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium break-all">
                      {showEmail ? user.email : '••••••••••••••••'}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => setShowEmail(!showEmail)}
                      title={showEmail ? "Hide Email" : "Show Email"}
                    >
                      {showEmail ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                  <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="w-full">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Manage your security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Password Change - Disabled for OAuth
              <div className="space-y-4">
                <div className="space-y-3 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-muted-foreground">Managed by your social login provider</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full sm:w-auto"
                  >
                    Change Password
                  </Button>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  Since you're logged in via {user.app_metadata.provider || 'a social provider'}, please change your password directly on their platform (Google, Discord, etc.).
                </div>
              </div>
              */}

              <div className="space-y-3 sm:flex sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium">Two-Factor Authentication</h4>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Deleting your account will permanently remove all your data including your player profile, teams (if you're a captain), tournament registrations, notifications, and team invitations. You will be signed out and may need to contact support to complete the account removal process.
                </AlertDescription>
              </Alert>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
