'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TournamentRegistrationBtnProps {
    tournamentId: string
}

export function TournamentRegistrationBtn({ tournamentId }: TournamentRegistrationBtnProps) {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [userTeam, setUserTeam] = useState<any>(null)
    const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
    const [status, setStatus] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const { toast } = useToast()
    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)

            if (authUser) {
                // Check if user has a player profile
                const { data: playerData } = await supabase
                    .from('players')
                    .select('id')
                    .eq('id', authUser.id)
                    .maybeSingle()

                setHasPlayerProfile(!!playerData)

                // Get user's team if captain
                const { data: teamData } = await supabase
                    .from('teams')
                    .select('*')
                    .eq('captain_id', authUser.id)
                    .single()

                setUserTeam(teamData)

                if (teamData) {
                    const { data: registration } = await supabase
                        .from('tournament_registrations')
                        .select('status')
                        .eq('tournament_id', tournamentId)
                        .eq('team_id', teamData.id)
                        .single()

                    if (registration) {
                        let s = (registration.status || 'pending').toLowerCase()
                        if (s === 'confirmed') s = 'approved'
                        setStatus(s)
                    }
                }
            }
            setInitialLoading(false)
        }

        fetchData()
    }, [tournamentId, supabase])

    const handleRegister = async () => {
        if (!userTeam) return
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch('/api/tournament-registrations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    tournament_id: tournamentId,
                    team_id: userTeam.id,
                }),
            })

            if (response.ok) {
                setStatus('pending')
                toast({
                    title: "Registration Submitted",
                    description: "Your team registration is pending admin approval.",
                })
            } else {
                const error = await response.json()
                if (error.error?.includes('pending') || error.error?.includes('already')) {
                    setStatus('pending')
                }
                toast({
                    title: "Registration Failed",
                    description: error.error || "Failed to register for tournament.",
                    variant: "destructive",
                })
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "An unexpected error occurred.",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    if (initialLoading) {
        return <div className="h-10 w-32 bg-white/5 animate-pulse rounded-lg" />
    }

    if (!user) {
        return (
            <Button
                className="px-6 py-2 bg-slate-900/40 border border-white/10 text-white/50 font-bold uppercase tracking-[0.2em] text-[10px] rounded-lg hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5 transition-all duration-300 shadow-none hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                onClick={() => router.push('/auth')}
            >
                Login to Register
            </Button>
        )
    }

    if (!hasPlayerProfile) {
        return (
            <Button
                className="px-6 py-2 bg-slate-900/40 border border-cyan-500/20 text-cyan-500/80 font-bold uppercase tracking-[0.2em] text-[10px] rounded-lg hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all duration-300 shadow-none hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                onClick={() => router.push('/setup-profile')}
            >
                Setup Profile
            </Button>
        )
    }

    if (!userTeam) {
        return (
            <Button
                className="px-6 py-2 bg-slate-900/40 border border-indigo-500/20 text-indigo-400/80 font-bold uppercase tracking-[0.2em] text-[10px] rounded-lg hover:border-indigo-400 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all duration-300 shadow-none hover:shadow-[0_0_20px_rgba(129,140,248,0.1)]"
                onClick={() => router.push('/create-team')}
            >
                Create Squad
            </Button>
        )
    }

    if (status === 'approved') {
        return (
            <div className="px-6 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5" /> Confirmed
            </div>
        )
    }

    if (status === 'pending') {
        return (
            <div className="px-6 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Pending
            </div>
        )
    }

    return (
        <button
            onClick={handleRegister}
            disabled={loading}
            style={{
                backgroundImage: `url(${loading ? '/tournament_assets/regester_button_pressed_small.png' : '/tournament_assets/regester_button_small.png'})`,
                backgroundSize: '100% 100%'
            }}
            className="group/btn relative h-12 w-48 bg-no-repeat bg-center flex items-center justify-center transition-all active:scale-95 hover:brightness-110"
        >
            <span className="text-slate-950 font-bold text-[10px] tracking-[0.15em] uppercase drop-shadow-sm mt-0.5 group-active/btn:mt-1 transition-all">
                {loading ? 'TRANSMITTING' : 'Register Squad'}
            </span>
        </button>
    )
}
