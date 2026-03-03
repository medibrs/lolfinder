/**
 * One-time migration script: Strip 42 OAuth PII from existing users.
 *
 * Removes `username`, `avatar_url`, and `full_name` from raw_user_meta_data
 * for all users who signed up via the 42 provider.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/strip-42-pii.js
 *
 * Safe to run multiple times (idempotent).
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('Fetching all users...')
  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.error('Failed to list users:', error.message)
    process.exit(1)
  }

  // Filter to users from the 42 provider who still have PII in metadata
  const targetUsers = users.filter(u => {
    const meta = u.user_metadata || {}
    return (
      meta.provider === '42' &&
      (meta.username || meta.avatar_url || meta.full_name)
    )
  })

  console.log(`Found ${targetUsers.length} user(s) with 42 PII to clean up (out of ${users.length} total)`)

  if (targetUsers.length === 0) {
    console.log('Nothing to do — all clean!')
    return
  }

  let success = 0
  let failed = 0

  for (const user of targetUsers) {
    // Supabase merges user_metadata, so we must explicitly null out PII fields
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        username: null,
        avatar_url: null,
        full_name: null,
      }
    })

    if (updateError) {
      console.error(`  ✗ Failed to update ${user.email}: ${updateError.message}`)
      failed++
    } else {
      console.log(`  ✓ Stripped PII from ${user.email}`)
      success++
    }
  }

  console.log(`\nDone! ${success} cleaned, ${failed} failed.`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
