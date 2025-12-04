'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'

interface AvatarPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatar?: number | null
  onAvatarSelect: (avatarId: number) => void
  disabled?: boolean
}

export function AvatarPicker({ open, onOpenChange, currentAvatar, onAvatarSelect, disabled = false }: AvatarPickerProps) {
  const [takenAvatars, setTakenAvatars] = useState<{id: number; teamName: string; teamId: string}[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTakenAvatars = async () => {
    try {
      const response = await fetch('/api/teams/taken-avatars')
      if (response.ok) {
        const data = await response.json()
        setTakenAvatars(data.takenAvatars || [])
      }
    } catch (error) {
      console.error('Error fetching taken avatars:', error)
    }
  }

  useEffect(() => {
    if (open) {
      fetchTakenAvatars()
    }
  }, [open])

  const handleAvatarSelect = async (avatarId: number) => {
    if (disabled) return
    onAvatarSelect(avatarId)
    onOpenChange(false) // Close dialog after selection
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto mx-2 sm:mx-4">
        <DialogHeader>
          <DialogTitle>Choose Team Avatar</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select an avatar for your team. Only available avatars are shown.
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0 p-3 sm:p-4">
          {Array.from({ length: 4016 - 3905 + 1 }, (_, i) => 3905 + i)
            .filter((avatarId) => {
              // Show if it's the current avatar or if it's not taken
              return currentAvatar === avatarId || !takenAvatars.some(taken => taken.id === avatarId)
            })
            .map((avatarId) => {
              const isCurrentAvatar = currentAvatar === avatarId
              
              return (
                <button
                  key={avatarId}
                  onClick={() => handleAvatarSelect(avatarId)}
                  disabled={disabled}
                  className={`relative group rounded-none overflow-hidden border-2 transition-all active:scale-95 aspect-square focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    isCurrentAvatar 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-border active:border-primary hover:border-primary hover:scale-105'
                  }`}
                  title={isCurrentAvatar ? 'Current Avatar' : 'Available'}
                >
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${avatarId}.png`}
                    alt={`Avatar ${avatarId}`}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                  />
                  {isCurrentAvatar && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary rounded-full p-2">
                        <svg className="w-6 h-6 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border border-primary rounded"></div>
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border border-border rounded"></div>
            <span>Available</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface AvatarPreviewProps {
  avatarId?: number | null
  onEdit?: () => void
  showEditButton?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function AvatarPreview({ avatarId, onEdit, showEditButton = false, size = 'md' }: AvatarPreviewProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  }

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  }

  return (
    <div 
      className={`relative ${showEditButton ? 'cursor-pointer' : ''}`}
      onClick={showEditButton && onEdit ? onEdit : undefined}
    >
      <div className={`${sizeClasses[size]} rounded-xl overflow-hidden border-2 border-border bg-gradient-to-br from-primary/10 to-accent/10`}>
        {avatarId ? (
          <Image 
            src={getTeamAvatarUrl(avatarId) ?? ''} 
            alt="Team Avatar"
            width={80}
            height={80}
            className="w-full h-full object-cover"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shield className={`${iconSizes[size]} text-muted-foreground`} />
          </div>
        )}
      </div>
      {showEditButton && onEdit && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute -bottom-2 -right-2 h-7 w-7 sm:h-6 sm:w-6 rounded-full p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <svg className="h-3 w-3 sm:h-3 sm:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Button>
      )}
    </div>
  )
}
