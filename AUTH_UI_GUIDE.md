# Supabase Auth UI - Quick Setup Guide

The **@supabase/auth-ui-react** library provides beautiful, pre-built authentication components that handle all the complexity for you!

## ✨ What You Get

✅ **Pre-built UI components** - No need to build forms from scratch  
✅ **Multiple auth methods** - Email, OAuth, Magic Links  
✅ **Customizable themes** - Match your app's design  
✅ **Automatic validation** - Built-in error handling  
✅ **Responsive design** - Works on all devices  
✅ **Dark mode support** - Automatic theme switching  

---

## 🚀 Quick Start

### 1. Create Supabase Client for Browser

```typescript
// lib/supabase-browser.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 2. Create Auth Page with Pre-built UI

```typescript
// app/auth/page.tsx
'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'

export default function AuthPage() {
  const supabase = createClient()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          League of Legends Tournament Platform
        </h1>
        
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['discord', 'google', 'github']}
          redirectTo={`${window.location.origin}/auth/callback`}
        />
      </div>
    </div>
  )
}
```

That's it! You now have a complete auth page with:
- Email/Password login
- Sign up form
- Password reset
- OAuth providers (Discord, Google, GitHub)
- Beautiful UI

---

## 🎨 Customization

### Custom Theme Colors

```typescript
<Auth
  supabaseClient={supabase}
  appearance={{
    theme: ThemeSupa,
    variables: {
      default: {
        colors: {
          brand: '#3b82f6',        // Primary color (blue)
          brandAccent: '#2563eb',  // Darker blue
          brandButtonText: 'white',
          defaultButtonBackground: '#f3f4f6',
          defaultButtonBackgroundHover: '#e5e7eb',
        },
        space: {
          inputPadding: '12px',
          buttonPadding: '12px 24px',
        },
        borderWidths: {
          buttonBorderWidth: '1px',
          inputBorderWidth: '1px',
        },
        radii: {
          borderRadiusButton: '8px',
          buttonBorderRadius: '8px',
          inputBorderRadius: '8px',
        },
      },
    },
  }}
  providers={['discord']}
/>
```

### Gaming Theme (Dark Mode)

```typescript
<Auth
  supabaseClient={supabase}
  appearance={{
    theme: ThemeSupa,
    variables: {
      default: {
        colors: {
          brand: '#8b5cf6',           // Purple
          brandAccent: '#7c3aed',     // Darker purple
          brandButtonText: 'white',
          defaultButtonBackground: '#1f2937',
          defaultButtonBackgroundHover: '#374151',
          inputBackground: '#1f2937',
          inputText: 'white',
          inputBorder: '#4b5563',
          inputBorderHover: '#6b7280',
          inputBorderFocus: '#8b5cf6',
        },
      },
    },
    className: {
      container: 'bg-gray-900 text-white',
      button: 'font-semibold',
      input: 'bg-gray-800',
    },
  }}
  providers={['discord']}
  theme="dark"
/>
```

### Only Email/Password (No OAuth)

```typescript
<Auth
  supabaseClient={supabase}
  appearance={{ theme: ThemeSupa }}
  providers={[]}  // Empty array = no OAuth buttons
  view="sign_in"  // or "sign_up"
/>
```

### Only OAuth (No Email/Password)

```typescript
<Auth
  supabaseClient={supabase}
  appearance={{ theme: ThemeSupa }}
  providers={['discord', 'google']}
  onlyThirdPartyProviders={true}  // Hide email/password form
/>
```

---

## 🎮 Discord-First Auth (Recommended for Gaming)

```typescript
// app/auth/page.tsx
'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'

export default function AuthPage() {
  const supabase = createClient()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-purple-500/20">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              LoL Tournaments
            </h1>
            <p className="text-gray-400">
              Join the competitive scene
            </p>
          </div>

          {/* Auth UI */}
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#5865F2',              // Discord blue
                    brandAccent: '#4752C4',
                    brandButtonText: 'white',
                    defaultButtonBackground: '#2C2F33',
                    defaultButtonBackgroundHover: '#23272A',
                    inputBackground: '#2C2F33',
                    inputText: 'white',
                    inputBorder: '#40444B',
                    inputBorderHover: '#5865F2',
                    inputBorderFocus: '#5865F2',
                  },
                  space: {
                    inputPadding: '14px',
                    buttonPadding: '14px 24px',
                  },
                  radii: {
                    borderRadiusButton: '8px',
                    inputBorderRadius: '8px',
                  },
                },
              },
              className: {
                button: 'font-semibold transition-all',
                input: 'transition-all',
              },
            }}
            providers={['discord']}
            socialLayout="vertical"
            redirectTo={`${window.location.origin}/auth/callback`}
            theme="dark"
          />

          {/* Footer */}
          <p className="text-center text-gray-500 text-sm mt-6">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## 🔄 Auth Callback Handler

Create this route to handle OAuth redirects:

```typescript
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to error page
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

---

## 🔒 Protected Dashboard

```typescript
// app/dashboard/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back, {user.email}!
            </p>
          </div>
          <LogoutButton />
        </div>

        {/* Dashboard content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Your Profile</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your player profile
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Your Team</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage your team
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Tournaments</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Browse upcoming tournaments
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 🚪 Logout Button Component

```typescript
// components/logout-button.tsx
'use client'

import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <Button onClick={handleLogout} variant="outline">
      Logout
    </Button>
  )
}
```

---

## 🎯 Available Auth Views

The Auth UI component supports different views:

```typescript
// Sign In (default)
<Auth supabaseClient={supabase} view="sign_in" />

// Sign Up
<Auth supabaseClient={supabase} view="sign_up" />

// Forgot Password
<Auth supabaseClient={supabase} view="forgotten_password" />

// Update Password
<Auth supabaseClient={supabase} view="update_password" />

// Magic Link
<Auth supabaseClient={supabase} view="magic_link" />
```

---

## 🌐 Enable OAuth Providers in Supabase

### Discord (Recommended for Gaming!)

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Go to **OAuth2** → **General**
4. Add Redirect URL: `https://your-project.supabase.co/auth/v1/callback`
5. Copy **Client ID** and **Client Secret**
6. In Supabase Dashboard:
   - Go to **Authentication** → **Providers**
   - Enable **Discord**
   - Paste Client ID and Secret
   - Save

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

### GitHub

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create new OAuth App
3. Add callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

---

## 📱 Responsive Layout

```typescript
<div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
  <div className="w-full max-w-md">
    <Auth
      supabaseClient={supabase}
      appearance={{
        theme: ThemeSupa,
        className: {
          container: 'w-full',
          button: 'w-full',
        },
      }}
      providers={['discord']}
    />
  </div>
</div>
```

---

## 🎨 Available Themes

```typescript
import { 
  ThemeSupa,      // Default theme
  ThemeMinimal,   // Minimal design
} from '@supabase/auth-ui-shared'

// Use theme
<Auth
  supabaseClient={supabase}
  appearance={{ theme: ThemeSupa }}
/>
```

---

## 🔐 Magic Link (Passwordless)

```typescript
<Auth
  supabaseClient={supabase}
  appearance={{ theme: ThemeSupa }}
  providers={[]}
  view="magic_link"
  magicLink={true}
/>
```

Users receive an email with a login link - no password needed!

---

## ✅ Complete Example with All Features

```typescript
// app/auth/page.tsx
'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          router.push('/dashboard')
          router.refresh()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-purple-500/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              LoL Tournaments
            </h1>
            <p className="text-gray-400">
              Join the competitive scene
            </p>
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#8b5cf6',
                    brandAccent: '#7c3aed',
                    brandButtonText: 'white',
                    defaultButtonBackground: '#2C2F33',
                    defaultButtonBackgroundHover: '#23272A',
                    inputBackground: '#2C2F33',
                    inputText: 'white',
                    inputBorder: '#40444B',
                    inputBorderHover: '#8b5cf6',
                    inputBorderFocus: '#8b5cf6',
                  },
                  space: {
                    inputPadding: '14px',
                    buttonPadding: '14px 24px',
                  },
                  radii: {
                    borderRadiusButton: '8px',
                    inputBorderRadius: '8px',
                  },
                },
              },
            }}
            providers={['discord', 'google']}
            redirectTo={`${window.location.origin}/auth/callback`}
            theme="dark"
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email Address',
                  password_label: 'Password',
                  button_label: 'Sign In',
                  social_provider_text: 'Sign in with {{provider}}',
                },
                sign_up: {
                  email_label: 'Email Address',
                  password_label: 'Create Password',
                  button_label: 'Create Account',
                  social_provider_text: 'Sign up with {{provider}}',
                },
              },
            }}
          />

          <p className="text-center text-gray-500 text-sm mt-6">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## 🎉 Benefits of Auth UI

✅ **5 minutes to implement** - vs hours of custom forms  
✅ **Production-ready** - Tested and secure  
✅ **Accessible** - WCAG compliant  
✅ **Customizable** - Match your brand  
✅ **Maintained** - Updates from Supabase team  
✅ **Multiple providers** - Easy to add OAuth  
✅ **Error handling** - Built-in validation  
✅ **Responsive** - Mobile-friendly  

---

## 📚 Documentation

- [Auth UI React Docs](https://supabase.com/docs/guides/auth/auth-helpers/auth-ui)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Theme Customization](https://supabase.com/docs/guides/auth/auth-helpers/auth-ui#customization)

---

## ✅ Summary

**You now have:**
- ✅ Pre-built auth UI components installed
- ✅ Email/Password authentication
- ✅ OAuth providers (Discord, Google, etc.)
- ✅ Beautiful, customizable design
- ✅ Automatic session management
- ✅ Protected routes
- ✅ Logout functionality

**Just create `/app/auth/page.tsx` and you're done!** 🚀
