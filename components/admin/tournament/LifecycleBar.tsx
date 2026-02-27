'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
    CheckCircle2, Circle, Play, Pause, XCircle,
    Archive, ChevronRight, Loader2, Shield, Lock
} from 'lucide-react'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ──────────────────────────────────────────────────────────

type TournamentState =
    | 'Registration' | 'Seeding' | 'In_Progress'
    | 'Paused' | 'Completed' | 'Cancelled' | 'Archived'

interface StateCapabilities {
    can_register: boolean
    can_edit_seeding: boolean
    can_generate_bracket: boolean
    can_play_matches: boolean
    can_advance_round: boolean
    can_modify_pairings: boolean
    is_mutable: boolean
    is_terminal: boolean
}

interface LifecycleData {
    state: TournamentState
    capabilities: StateCapabilities
    valid_transitions: TournamentState[]
    tournament_name: string
}

interface LifecycleBarProps {
    tournamentId: string
    onStateChanged?: (state: TournamentState, capabilities: StateCapabilities) => void
}

// ─── Constants ──────────────────────────────────────────────────────

const STATE_ORDER: TournamentState[] = [
    'Registration', 'Seeding', 'In_Progress', 'Completed'
]

const STATE_CONFIG: Record<TournamentState, {
    label: string
    color: string
    bgColor: string
    borderColor: string
    glowColor: string
    icon: typeof Circle
}> = {
    Registration: {
        label: 'Registration',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        glowColor: 'shadow-blue-500/20',
        icon: Circle,
    },
    Seeding: {
        label: 'Seeding',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        glowColor: 'shadow-amber-500/20',
        icon: Shield,
    },
    In_Progress: {
        label: 'In Progress',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        glowColor: 'shadow-green-500/20',
        icon: Play,
    },
    Paused: {
        label: 'Paused',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        glowColor: 'shadow-orange-500/20',
        icon: Pause,
    },
    Completed: {
        label: 'Completed',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        glowColor: 'shadow-emerald-500/20',
        icon: CheckCircle2,
    },
    Cancelled: {
        label: 'Cancelled',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        glowColor: 'shadow-red-500/20',
        icon: XCircle,
    },
    Archived: {
        label: 'Archived',
        color: 'text-zinc-400',
        bgColor: 'bg-zinc-500/10',
        borderColor: 'border-zinc-500/30',
        glowColor: 'shadow-zinc-500/20',
        icon: Archive,
    },
}

const TRANSITION_LABELS: Partial<Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }>> = {
    'Registration->Seeding': { label: 'Close Registration', variant: 'default' },
    'Seeding->In_Progress': { label: 'Start Tournament', variant: 'default' },
    'Seeding->Registration': { label: 'Reopen Registration', variant: 'outline' },
    'In_Progress->Paused': { label: 'Pause', variant: 'secondary' },
    'In_Progress->Completed': { label: 'Complete Tournament', variant: 'default' },
    'Paused->In_Progress': { label: 'Resume', variant: 'default' },
    'Registration->Cancelled': { label: 'Cancel', variant: 'destructive' },
    'Seeding->Cancelled': { label: 'Cancel', variant: 'destructive' },
    'In_Progress->Cancelled': { label: 'Cancel', variant: 'destructive' },
    'Paused->Cancelled': { label: 'Cancel', variant: 'destructive' },
    'Completed->Archived': { label: 'Archive', variant: 'secondary' },
    'Cancelled->Archived': { label: 'Archive', variant: 'secondary' },
    'Cancelled->Registration': { label: 'Revive Tournament', variant: 'outline' },
}

// ─── Component ──────────────────────────────────────────────────────

export default function LifecycleBar({ tournamentId, onStateChanged }: LifecycleBarProps) {
    const { toast } = useToast()
    const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null)
    const [loading, setLoading] = useState(true)
    const [transitioning, setTransitioning] = useState<string | null>(null)
    const [confirmDialog, setConfirmDialog] = useState<{ to: TournamentState; label: string } | null>(null)

    const fetchLifecycle = useCallback(async () => {
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/lifecycle`)
            if (res.ok) {
                const data = await res.json()
                setLifecycle(data)
                onStateChanged?.(data.state, data.capabilities)
            }
        } catch (err) {
            console.error('Failed to fetch lifecycle:', err)
        } finally {
            setLoading(false)
        }
    }, [tournamentId, onStateChanged])

    useEffect(() => { fetchLifecycle() }, [fetchLifecycle])

    const handleTransition = async (to: TournamentState) => {
        setTransitioning(to)
        setConfirmDialog(null)
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/lifecycle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to }),
            })
            const data = await res.json()

            if (!res.ok) {
                toast({
                    title: 'Transition Blocked',
                    description: data.error || 'Cannot perform this transition.',
                    variant: 'destructive',
                })
                return
            }

            setLifecycle(data)
            onStateChanged?.(data.state, data.capabilities)
            const config = STATE_CONFIG[to]
            toast({
                title: `Tournament ${config.label}`,
                description: `Status changed to ${config.label}.`,
            })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setTransitioning(null)
        }
    }

    const requestTransition = (to: TournamentState) => {
        const key = `${lifecycle?.state}->${to}`
        const label = TRANSITION_LABELS[key]?.label || to.replace('_', ' ')

        // Destructive transitions need confirmation
        if (to === 'Cancelled' || to === 'Archived' || to === 'Completed') {
            setConfirmDialog({ to, label })
        } else {
            handleTransition(to)
        }
    }

    if (loading || !lifecycle) {
        return (
            <div className="h-16 rounded-xl border border-border bg-card/50 animate-pulse" />
        )
    }

    const currentState = lifecycle.state
    const currentIdx = STATE_ORDER.indexOf(currentState)
    const isSpecialState = currentState === 'Paused' || currentState === 'Cancelled' || currentState === 'Archived'

    // Split transitions into primary (forward) and secondary (backward/cancel)
    const forwardTransitions = lifecycle.valid_transitions.filter(t =>
        !['Cancelled', 'Archived'].includes(t) && t !== lifecycle.state
    )
    const dangerTransitions = lifecycle.valid_transitions.filter(t =>
        ['Cancelled'].includes(t)
    )
    const otherTransitions = lifecycle.valid_transitions.filter(t =>
        !forwardTransitions.includes(t) && !dangerTransitions.includes(t) && t !== lifecycle.state
    )

    return (
        <>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                {/* State Progress Bar */}
                <div className="px-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-1">
                        {STATE_ORDER.map((state, idx) => {
                            const config = STATE_CONFIG[state]
                            const Icon = config.icon
                            const isCurrent = state === currentState
                            const isPast = !isSpecialState && idx < currentIdx
                            const isFuture = !isSpecialState && idx > currentIdx

                            return (
                                <div key={state} className="flex items-center flex-1">
                                    <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 transition-all duration-300
                    ${isCurrent ? `${config.bgColor} ${config.borderColor} border shadow-lg ${config.glowColor}` : ''}
                    ${isPast ? 'opacity-50' : ''}
                    ${isFuture ? 'opacity-30' : ''}
                  `}>
                                        <Icon className={`h-4 w-4 flex-shrink-0 ${isCurrent ? config.color : isPast ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                                        <span className={`text-xs font-medium truncate ${isCurrent ? config.color : 'text-muted-foreground'}`}>
                                            {config.label}
                                        </span>
                                    </div>
                                    {idx < STATE_ORDER.length - 1 && (
                                        <ChevronRight className={`h-3 w-3 mx-1 flex-shrink-0 ${isPast ? 'text-muted-foreground/50' : 'text-muted-foreground/20'}`} />
                                    )}
                                </div>
                            )
                        })}

                        {/* Show special state badge if we're in one */}
                        {isSpecialState && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ml-2 ${STATE_CONFIG[currentState].bgColor} ${STATE_CONFIG[currentState].borderColor}`}>
                                {(() => { const Icon = STATE_CONFIG[currentState].icon; return <Icon className={`h-4 w-4 ${STATE_CONFIG[currentState].color}`} /> })()}
                                <span className={`text-xs font-medium ${STATE_CONFIG[currentState].color}`}>
                                    {STATE_CONFIG[currentState].label}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        {lifecycle.capabilities.is_terminal ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Lock className="h-3.5 w-3.5" />
                                <span className="text-xs">Final state — no further changes</span>
                            </div>
                        ) : lifecycle.capabilities.is_mutable ? (
                            <Badge variant="outline" className="text-xs font-normal border-green-500/30 text-green-400">
                                Mutable
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs font-normal border-zinc-500/30 text-zinc-400">
                                Locked
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Other transitions (reopen, revive, archive) */}
                        {otherTransitions.map(to => {
                            const key = `${currentState}->${to}`
                            const config = TRANSITION_LABELS[key]
                            return (
                                <Button
                                    key={to}
                                    size="sm"
                                    variant={config?.variant || 'outline'}
                                    onClick={() => requestTransition(to)}
                                    disabled={!!transitioning}
                                    className="text-xs h-8"
                                >
                                    {transitioning === to && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                                    {config?.label || to.replace('_', ' ')}
                                </Button>
                            )
                        })}

                        {/* Primary forward transitions */}
                        {forwardTransitions.map(to => {
                            const key = `${currentState}->${to}`
                            const config = TRANSITION_LABELS[key]
                            return (
                                <Button
                                    key={to}
                                    size="sm"
                                    variant={config?.variant || 'default'}
                                    onClick={() => requestTransition(to)}
                                    disabled={!!transitioning}
                                    className="text-xs h-8"
                                >
                                    {transitioning === to && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                                    {config?.label || to.replace('_', ' ')}
                                </Button>
                            )
                        })}

                        {/* Danger transitions */}
                        {dangerTransitions.map(to => {
                            const key = `${currentState}->${to}`
                            const config = TRANSITION_LABELS[key]
                            return (
                                <Button
                                    key={to}
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => requestTransition(to)}
                                    disabled={!!transitioning}
                                    className="text-xs h-8"
                                >
                                    {transitioning === to && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                                    {config?.label || to.replace('_', ' ')}
                                </Button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm: {confirmDialog?.label}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog?.to === 'Cancelled'
                                ? 'Cancelling the tournament will freeze all brackets, matches, and pairings. This action cannot be easily undone.'
                                : confirmDialog?.to === 'Completed'
                                    ? 'Completing the tournament will lock all results and prevent further match updates.'
                                    : 'Archiving the tournament will make it read-only. No further state changes will be possible.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDialog && handleTransition(confirmDialog.to)}
                            className={confirmDialog?.to === 'Cancelled' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                        >
                            {confirmDialog?.label}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
