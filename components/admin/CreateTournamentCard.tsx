'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Trophy, Plus, CheckCircle, XCircle, ImagePlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

export default function CreateTournamentCard() {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_teams: 8,
    start_date: '',
    end_date: '',
    prize_pool: '',
    rules: '',
    banner_image: ''
  })
  const supabase = createClient()
  const { toast } = useToast()

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const uploadFormData = new FormData()
    uploadFormData.append('file', file)

    try {
      const response = await fetch('/api/tournaments/upload-banner', {
        method: 'POST',
        body: uploadFormData
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload banner')

      setBannerPreview(data.url)
      setFormData(prev => ({ ...prev, banner_image: data.url }))
      toast({ title: "Success", description: "Banner uploaded successfully" })
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const removeBanner = () => {
    setBannerPreview(null)
    setFormData(prev => ({ ...prev, banner_image: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.start_date || !formData.end_date) {
        throw new Error('Name, start date, and end date are required')
      }

      // Validate dates
      const startDate = new Date(formData.start_date)
      const endDate = new Date(formData.end_date)

      if (startDate >= endDate) {
        throw new Error('End date must be after start date')
      }

      const tournamentData = {
        name: formData.name,
        description: formData.description || null,
        max_teams: formData.max_teams,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        prize_pool: formData.prize_pool || null,
        rules: formData.rules || null,
        banner_image: formData.banner_image || null
      }

      const { error } = await supabase.from('tournaments').insert(tournamentData)

      if (error) {
        throw error
      }

      // Show success toast
      toast({
        title: "Tournament Created!",
        description: `${formData.name} has been successfully created.`,
        duration: 5000,
      })

      // Reset form
      setFormData({
        name: '',
        description: '',
        max_teams: 8,
        start_date: '',
        end_date: '',
        prize_pool: '',
        rules: '',
        banner_image: ''
      })
      setBannerPreview(null)
    } catch (error: any) {
      // Show error toast
      toast({
        title: "Failed to Create Tournament",
        description: error.message || "An error occurred while creating the tournament.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card border-border p-6 overflow-hidden">
      <div className="text-4xl mb-4">🏆</div>
      <CardHeader className="p-0 mb-6">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Create Tournament
        </CardTitle>
        <CardDescription>
          Create a new tournament for your community
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Tournament Banner</Label>
          <div className="relative group">
            {bannerPreview ? (
              <div className="relative aspect-[5/2] w-full rounded-lg overflow-hidden border border-border bg-muted">
                <Image
                  src={bannerPreview}
                  alt="Banner Preview"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={removeBanner}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors z-10"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Label htmlFor="banner-upload" className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium transition-all">
                    Change Banner
                  </Label>
                </div>
              </div>
            ) : (
              <Label
                htmlFor="banner-upload"
                className="flex flex-col items-center justify-center aspect-[5/2] w-full rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload Banner Image</p>
                    <p className="text-xs text-muted-foreground">Recommend 2000x800 (Max 5MB)</p>
                  </div>
                </div>
              </Label>
            )}
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={uploading}
            />
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-xs text-primary animate-pulse mt-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Uploading image to Azure cdn...
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="name">Tournament Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Summer Championship"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Tournament details and rules..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_teams">Max Teams</Label>
            <Input
              id="max_teams"
              type="number"
              min="2"
              max="64"
              value={formData.max_teams}
              onChange={(e) => setFormData({ ...formData, max_teams: parseInt(e.target.value) })}
              required
            />
          </div>

          <div>
            <Label htmlFor="prize_pool">Prize Pool</Label>
            <Input
              id="prize_pool"
              value={formData.prize_pool}
              onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
              placeholder="$10,000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="rules">Rules</Label>
          <Textarea
            id="rules"
            value={formData.rules}
            onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
            placeholder="Tournament rules and format..."
            rows={4}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating...' : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </>
          )}
        </Button>
      </form>
    </Card>
  )
}
