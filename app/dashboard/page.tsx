import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  // Check if user has a player profile
  const { data: playerProfile, error: profileError } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .single()

  // If no profile exists, redirect to setup
  if (!playerProfile && profileError?.code === 'PGRST116') {
    redirect('/setup-profile')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Welcome back, {user.email}!
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </form>
        </div>

        {/* Profile Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Your Tournament Profile
          </h2>
          {playerProfile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-purple-600 dark:text-purple-400">
                    {playerProfile.summoner_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {playerProfile.summoner_name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {playerProfile.tier} • {playerProfile.main_role} • {playerProfile.region}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {playerProfile.looking_for_team && (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                    Looking for Team
                  </span>
                )}
                <Link
                  href="/players/[id]"
                  className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
                >
                  View Profile →
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Complete your profile to start participating in tournaments
              </p>
              <Link
                href="/setup-profile"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Complete Profile
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Create Tournament
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Launch your own competitive tournament
            </p>
            <Link
              href="/create-tournament"
              className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
            >
              Create Tournament →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Build Team
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create or join a competitive team
            </p>
            <Link
              href="/create-team"
              className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
            >
              Create Team →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Browse Tournaments
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Find and join upcoming tournaments
            </p>
            <Link
              href="/tournaments"
              className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
            >
              Browse Tournaments →
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Links
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/players"
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition text-center"
            >
              <div className="text-2xl mb-2">👥</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Browse Players
              </div>
            </Link>
            <Link
              href="/teams"
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition text-center"
            >
              <div className="text-2xl mb-2">🛡️</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Browse Teams
              </div>
            </Link>
            <Link
              href="/search"
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition text-center"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Advanced Search
              </div>
            </Link>
            <Link
              href="/tournaments"
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition text-center"
            >
              <div className="text-2xl mb-2">🏆</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Tournaments
              </div>
            </Link>
          </div>
        </div>

        {/* User Info */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Account Information
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Email:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {user.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">User ID:</span>
              <span className="text-gray-900 dark:text-white font-mono text-xs">
                {user.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Account Created:</span>
              <span className="text-gray-900 dark:text-white">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
