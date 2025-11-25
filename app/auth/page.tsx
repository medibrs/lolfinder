'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Shield, Trophy, Users, Zap } from 'lucide-react'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')

  useEffect(() => {
    // Check if user is already logged in and has profile
    const checkUserAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // Check if user has a profile
          const { data: playerProfile } = await supabase
            .from('players')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          // Redirect based on profile existence
          if (playerProfile) {
            router.push('/')
          } else {
            router.push('/setup-profile')
          }
        } else {
          setLoading(false)
        }
      } catch (error) {
        setLoading(false)
      }
    }

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
              router.push(redirectTo || '/')
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

    return () => subscription.unsubscribe()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 pt-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 pt-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Left Side - Hero Content */}
          <div className="text-center lg:text-left space-y-6 text-white">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                LoL Tournaments
              </h1>
              <p className="text-lg lg:text-2xl text-purple-100">
                Join the competitive League of Legends scene
              </p>
            </div>

            <div className="space-y-4 text-purple-200">
              <p className="text-base lg:text-lg">
                Create your profile, find teammates, and compete in tournaments
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Find Teammates</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Join Tournaments</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Shield className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Track Stats</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Zap className="h-5 w-5" />
                  </div>
                  <span className="text-sm">Level Up</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-sm lg:max-w-md bg-gray-900/90 backdrop-blur-sm border-purple-500/20 shadow-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader className="space-y-1 text-center pb-4">
                <CardTitle className="text-xl lg:text-2xl font-bold text-white">
                  {view === 'sign_in' ? 'Welcome Back' : 'Sign Up'}
                </CardTitle>
                <CardDescription className="text-purple-200 text-sm">
                  {view === 'sign_in' 
                    ? 'Sign in to access your tournament profile' 
                    : 'Join the League of Legends tournament community'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                {/* Toggle between Sign In and Sign Up */}
                <div className="flex rounded-lg bg-gray-800 p-1">
                  <button
                    onClick={() => setView('sign_in')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      view === 'sign_in'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setView('sign_up')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      view === 'sign_up'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Auth UI Component */}
                <Auth
                  supabaseClient={supabase}
                  view={view}
                  appearance={{
                    theme: ThemeSupa,
                    variables: {
                      default: {
                        colors: {
                          brand: '#8b5cf6',
                          brandAccent: '#7c3aed',
                          brandButtonText: 'white',
                          defaultButtonBackground: '#2C2F33',
                          defaultButtonBackgroundHover: '#40444B',
                          defaultButtonBorder: '#40444B',
                          defaultButtonText: '#FFFFFF',
                          inputBorder: '#40444B',
                          inputBorderHover: '#7289DA',
                          inputBorderFocus: '#8b5cf6',
                          inputText: '#FFFFFF',
                          inputLabelText: '#99AAB5',
                          anchorTextColor: '#8b5cf6',
                          anchorTextHoverColor: '#7c3aed',
                          messageText: '#ED4245',
                          messageTextDanger: '#ED4245',
                        },
                      },
                    },
                    className: {
                      button: 'font-semibold transition-all text-sm py-2 px-4 h-auto',
                      input: 'transition-all bg-gray-800 text-sm py-2 px-3 h-auto',
                      label: 'text-purple-200 font-medium text-xs',
                      message: 'text-xs',
                      container: 'space-y-3 max-h-[60vh] overflow-y-auto pr-2',
                      anchor: 'text-purple-400 hover:text-purple-300 text-xs',
                      divider: 'text-xs text-purple-300 my-2',
                    },
                  }}
                  providers={['discord', 'google']}
                  redirectTo={`${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
                  theme="dark"
                  localization={{
                    variables: {
                      sign_in: {
                        email_label: 'Email Address',
                        password_label: 'Password',
                        button_label: 'Sign In',
                        social_provider_text: 'Continue with {{provider}}',
                        link_text: 'Don\'t have an account? Sign up',
                        loading_button_label: 'Signing in...',
                      },
                      sign_up: {
                        email_label: 'Email Address',
                        password_label: 'Create Password',
                        button_label: 'Create Account',
                        social_provider_text: 'Continue with {{provider}}',
                        link_text: 'Already have an account? Sign in',
                        loading_button_label: 'Creating account...',
                      },
                      forgotten_password: {
                        email_label: 'Email Address',
                        button_label: 'Send Reset Email',
                        link_text: 'Remember your password? Sign in',
                        loading_button_label: 'Sending reset email...',
                      },
                    },
                  }}
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gray-900 px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Quick OAuth Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="discord"
                    onClick={() => supabase.auth.signInWithOAuth({
                      provider: 'discord',
                      options: { redirectTo: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback` }
                    })}
                    className="gap-2"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.5152.0699.0699 0 00-.0321.0277C.5334 9.0463-.319 13.5809.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.975 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                    </svg>
                    Discord
                  </Button>
                  <Button
                    variant="google"
                    onClick={() => supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback` }
                    })}
                    className="gap-2"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </Button>
                </div>

                <p className="text-center text-xs text-gray-500 mt-6">
                  By signing in, you agree to our{' '}
                  <a href="#" className="text-purple-400 hover:text-purple-300">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-purple-400 hover:text-purple-300">
                    Privacy Policy
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
