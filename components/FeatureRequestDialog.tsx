'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lightbulb, Send, Loader2, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FeatureRequestDialogProps {
  children: React.ReactNode
}

const CATEGORIES = [
  { value: 'UI/UX', label: 'UI/UX', color: '#6366f1', icon: '🎨' },
  { value: 'Gameplay', label: 'Gameplay', color: '#10b981', icon: '🎮' },
  { value: 'Teams', label: 'Teams', color: '#f59e0b', icon: '👥' },
  { value: 'Tournaments', label: 'Tournaments', color: '#ef4444', icon: '🏆' },
  { value: 'Profile', label: 'Profile', color: '#8b5cf6', icon: '👤' },
  { value: 'Performance', label: 'Performance', color: '#06b6d4', icon: '⚡' },
  { value: 'Other', label: 'Other', color: '#6b7280', icon: '📋' },
]

const PRIORITIES = [
  { value: 'Low', label: 'Low', color: 'bg-gray-500' },
  { value: 'Medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'High', label: 'High', color: 'bg-red-500' },
]

export default function FeatureRequestDialog({ children }: FeatureRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'Medium',
    use_case: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in to submit a feature request')
        return
      }

      // Get user's player ID
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('id', user.id)
        .single()

      if (playerError || !playerData) {
        setError('Player profile not found. Please complete your profile first.')
        return
      }

      // Submit the feature request
      const { error: submitError } = await supabase
        .from('feature_requests')
        .insert({
          user_id: playerData.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          priority: formData.priority,
          use_case: formData.use_case,
        })

      if (submitError) {
        setError(submitError.message)
        return
      }

      setSuccess(true)
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: '',
        priority: 'Medium',
        use_case: '',
      })

      // Close dialog after 2 seconds
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
      }, 2000)

    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = CATEGORIES.find(cat => cat.value === formData.category)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Request a Feature
          </DialogTitle>
          <DialogDescription>
            Help us improve LoLFinder by suggesting new features or improvements
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Feature Request Submitted!</h3>
            <p className="text-muted-foreground">
              Thank you for your suggestion! We'll review it and keep you updated on the progress.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Feature Title *
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief summary of your feature idea"
                required
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.title.length}/255 characters
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Category *
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category">
                    {selectedCategory && (
                      <div className="flex items-center gap-2">
                        <span>{selectedCategory.icon}</span>
                        <span>{selectedCategory.label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Priority
              </label>
              <div className="flex gap-2">
                {PRIORITIES.map((priority) => (
                  <Button
                    key={priority.value}
                    type="button"
                    variant={formData.priority === priority.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, priority: priority.value })}
                    className={formData.priority === priority.value ? priority.color : ''}
                  >
                    {priority.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                How important is this feature to you?
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Description *
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your feature idea in detail. What should it do? How would it work?"
                required
                rows={5}
                minLength={10}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 10 characters
              </p>
            </div>

            {/* Use Case */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Use Case
              </label>
              <Textarea
                value={formData.use_case}
                onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                placeholder="How would this feature help you or other users? What problem would it solve?"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional but helps us understand the value
              </p>
            </div>

            {/* Info Box */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your feature request will be reviewed by our team. You can track its status in your profile dashboard.
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !formData.title || !formData.description || !formData.category}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
