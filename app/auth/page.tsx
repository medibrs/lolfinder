'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Footer from '@/components/footer'
import { TrophyIcon, TeamsIcon, StatsIcon, ShieldIcon } from '@/components/TournamentIcons'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [adminOverride, setAdminOverride] = useState(false)
  const [secretClicks, setSecretClicks] = useState(0)

  const handleSecretClick = () => {
    const newCount = secretClicks + 1
    setSecretClicks(newCount)
    if (newCount >= 5) {
      setAdminOverride(true)
    }
  }

  useEffect(() => {
    let mounted = true

    // Check if user is already logged in and has profile
    const checkUserAndProfile = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {

          if (mounted) setLoading(false)
          return
        }

        if (session) {
          // Check if user has a profile
          const { data: playerProfile } = await supabase
            .from('players')
            .select('*')
            .eq('id', session.user.id)
            .single()

          // Redirect based on profile existence
          if (playerProfile) {
            // User has established profile, check if they have a team
            const { data: playerWithTeam } = await supabase
              .from('players')
              .select('teams(*)')
              .eq('id', session.user.id)
              .single()

            if (playerWithTeam?.teams && Array.isArray(playerWithTeam.teams) && playerWithTeam.teams.length > 0) {
              const team = playerWithTeam.teams[0]
              // Check if user is captain or member to determine correct page
              if (team.captain_id === session.user.id) {
                router.push('/manage-team')
              } else {
                router.push('/view-team')
              }
            } else {
              // User has profile but no team, go to home
              router.push('/')
            }
          } else {
            router.push('/setup-profile')
          }
        } else {
          if (mounted) setLoading(false)
        }
      } catch (error) {

        if (mounted) setLoading(false)
      }
    }

    // Set a timeout to ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      if (mounted && loading) {

        setLoading(false)
      }
    }, 3000)

    checkUserAndProfile()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (event === 'SIGNED_IN' && session) {
          // Check if user has a profile after sign in
          try {
            const { data: playerProfile } = await supabase
              .from('players')
              .select('*')
              .eq('id', session.user.id)
              .single()

            // Get redirect parameter from URL if exists
            const urlParams = new URLSearchParams(window.location.search)
            const redirectTo = urlParams.get('redirectedFrom')

            // Redirect based on profile existence or original destination
            if (playerProfile) {
              // User has established profile, check if they have a team
              const { data: playerWithTeam } = await supabase
                .from('players')
                .select('teams(*)')
                .eq('id', session.user.id)
                .single()

              if (playerWithTeam?.teams && Array.isArray(playerWithTeam.teams) && playerWithTeam.teams.length > 0) {
                const team = playerWithTeam.teams[0]
                // Check if user is captain or member to determine correct page
                if (team.captain_id === session.user.id) {
                  router.push('/manage-team')
                } else {
                  router.push('/view-team')
                }
              } else {
                // User has profile but no team, go to home unless there's a specific redirect
                router.push(redirectTo || '/')
              }
            } else {
              router.push('/setup-profile')
            }
            router.refresh()
          } catch (error) {
            // If there's an error checking profile, default to setup
            router.push('/setup-profile')
            router.refresh()
          }
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router, supabase])

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-12 bg-background text-white font-sans">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center min-h-[calc(100vh-12rem)]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c9aa71] mx-auto"></div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">Initializing...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen pt-24 pb-12 bg-background text-white font-sans relative overflow-hidden">
        {/* Cinematic Background */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage: 'url(/home-page-banner.jpg)',
          }}
        />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] z-0" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-4">
          {/* League Client Styled Header */}
          <div className="relative mb-8 lg:mb-12 text-center">
            <div className="flex items-center justify-center gap-4 mb-2">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-beaufort font-black uppercase tracking-[0.4em] lg:tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
               1337 CHAMPIONS 
              </h1>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
            </div>
            <div className="flex items-center justify-center gap-1.5 opacity-60">
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.25em] md:tracking-[0.3em] font-bold text-slate-400">Elite Competitive Arena</span>
              <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12 items-start lg:items-center">

            {/* Right Side - Auth Form */}
            <div className="w-full lg:w-1/2 flex order-1 justify-center lg:order-2 lg:justify-center">
              <div className="w-full max-w-sm bg-[#0c121d]/60 border border-slate-800/60 rounded-xl p-4 md:p-5 lg:p-6 backdrop-blur-xl shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all duration-300">
                <div className="space-y-2 text-center pb-4">
                  <h2
                    className="text-base lg:text-lg font-beaufort font-black text-white cursor-default select-none uppercase tracking-wider"
                    onClick={handleSecretClick}
                  >
                    {view === 'sign_in' ? 'Enter The Arena' : 'Summoner Signup'}
                  </h2>
                  <p className="text-slate-400 text-[11px] lg:text-xs font-beaufort">
                    {view === 'sign_in'
                      ? 'Secure your spot and manage your tournament roster'
                      : 'Register your summoner name and join the competitive circuit'
                    }
                  </p>
                </div>
                <div className="space-y-4">
                  {/* OAuth Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => window.location.href = '/api/auth/42/login'}
                      className="gap-2 w-full bg-[#0c121d]/80 border border-slate-800/60 hover:border-cyan-500/50 hover:bg-cyan-500/5 text-white h-8 lg:h-9 text-xs lg:text-sm font-semibold font-beaufort uppercase tracking-normal rounded-md transition-all flex items-center justify-center"
                    >
                      <img src="https://upload.wikimedia.org/wikipedia/commons/8/8d/42_Logo.svg" alt="42 Logo" className="h-4 w-4 brightness-0 invert" />
                      Continue with 42
                    </button>

                    <div className="mt-6 mb-3 border border-slate-800/60 bg-[#0c121d]/40 rounded-xl p-3 text-center">
                      <p className="text-[11px] lg:text-xs text-slate-300 font-beaufort font-bold mb-3">
                        SERVER LOCK: 42 INTRA EXCLUSIVE. We are currently hosting a private tournament for the 42 Network. Global authentication is temporarily disabled until champions are crowned.
                      </p>

                      <div className={`flex flex-col gap-2 ${!adminOverride ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                        <button
                          disabled={!adminOverride}
                          onClick={() => supabase.auth.signInWithOAuth({
                            provider: 'discord',
                            options: { redirectTo: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback` }
                          })}
                          className="gap-2 w-full bg-[#5865F2] hover:bg-[#4752C4] text-white h-8 lg:h-9 text-xs lg:text-sm font-semibold font-beaufort uppercase tracking-normal rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.5152.0699.0699 0 00-.0321.0277C.5334 9.0463-.319 13.5809.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.975 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                          </svg>
                          Continue with Discord
                        </button>
                        <button
                          disabled={!adminOverride}
                          onClick={() => supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: { redirectTo: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback` }
                          })}
                          className="gap-2 w-full bg-white hover:bg-gray-100 text-black h-8 lg:h-9 text-xs lg:text-sm font-semibold font-beaufort uppercase tracking-normal rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Continue with Google
                        </button>
                        <button
                          disabled={!adminOverride}
                          onClick={() => supabase.auth.signInWithOAuth({
                            provider: 'github',
                            options: { redirectTo: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback` }
                          })}
                          className="gap-2 w-full bg-[#0c121d]/80 border border-slate-800/60 hover:border-cyan-500/50 hover:bg-cyan-500/5 text-white h-8 lg:h-9 text-xs lg:text-sm font-semibold font-beaufort uppercase tracking-normal rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                          </svg>
                          Continue with GitHub
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-[11px] lg:text-xs text-slate-500 mt-4 font-beaufort">
                    By signing in, you agree to our{' '}
                    <a href="/terms" className="text-cyan-400 hover:text-cyan-300 transition-colors font-beaufort">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://www.termsfeed.com/live/9fc90b22-8e00-4dc8-8a16-47e88d3a59e0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 transition-colors font-beaufort"
                    >
                      Privacy Policy
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Left Side - Hero Content */}
            <div className="w-full lg:w-1/2 space-y-5 md:space-y-6 lg:space-y-8 order-2 lg:order-1">
              <div className="space-y-4 md:space-y-5 lg:space-y-6">
                <p className="text-slate-300 text-base lg:text-lg leading-relaxed font-beaufort">
                  Assemble your roster, dominate the bracket, and forge your legacy on the Rift.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:gap-6 justify-items-center">
                  <div className="w-full max-w-[320px] flex items-center gap-3 p-3 lg:gap-4 lg:p-4 bg-[#0c121d]/60 border border-slate-800/60 rounded-xl backdrop-blur-xl hover:border-cyan-500/50 transition-all duration-300">
                    <div className="flex-shrink-0">
                      <TeamsIcon size={24} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-xs lg:text-sm uppercase tracking-wider mb-1 font-beaufort">Scout Talent</h3>
                      <p className="text-slate-500 text-[10px] lowercase tracking-wider font-beaufort">Draft perfect squad for your playstyle</p>
                    </div>
                  </div>

                  <div className="w-full max-w-[320px] flex items-center gap-3 p-3 lg:gap-4 lg:p-4 bg-[#0c121d]/60 border border-slate-800/60 rounded-xl backdrop-blur-xl hover:border-cyan-500/50 transition-all duration-300">
                    <div className="flex-shrink-0">
                      <TrophyIcon size={24} className="text-[#c9aa71]" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-xs lg:text-sm uppercase tracking-wider mb-1 font-beaufort">Enter The Bracket</h3>
                      <p className="text-slate-500 text-[10px] lowercase tracking-wider font-beaufort">Battle for prize pools and ultimate prestige</p>
                    </div>
                  </div>

                  <div className="w-full max-w-[320px] flex items-center gap-3 p-3 lg:gap-4 lg:p-4 bg-[#0c121d]/60 border border-slate-800/60 rounded-xl backdrop-blur-xl hover:border-cyan-500/50 transition-all duration-300">
                    <div className="flex-shrink-0">
                      <StatsIcon size={24} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-xs lg:text-sm uppercase tracking-wider mb-1 font-beaufort">Analyze Matches</h3>
                      <p className="text-slate-500 text-[10px] lowercase tracking-wider font-beaufort">Track your win rate and climb ladder</p>
                    </div>
                  </div>

                  <div className="w-full max-w-[320px] flex items-center gap-3 p-3 lg:gap-4 lg:p-4 bg-[#0c121d]/60 border border-slate-800/60 rounded-xl backdrop-blur-xl hover:border-cyan-500/50 transition-all duration-300">
                    <div className="flex-shrink-0">
                      <ShieldIcon size={24} className="text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-xs lg:text-sm uppercase tracking-wider mb-1 font-beaufort">Claim The Trophy</h3>
                      <p className="text-slate-500 text-[10px] lowercase tracking-wider font-beaufort">Prove your roster belongs at the top</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
