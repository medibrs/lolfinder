'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChatPersistent } from '@/components/realtime-chat-persistent'
import { getProfileIconUrl } from '@/lib/ddragon'
import { cdnUrl } from '@/lib/cdn'
import { MessageSquare, ArrowLeft, Search, Plus, Users } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

/* ── Types ── */

interface OtherUser {
  id: string
  summonerName: string
  profileIconId?: number | null
  tier?: string | null
  mainRole?: string | null
}

interface LastMessage {
  content: string
  createdAt: string
  userName: string
}

interface Conversation {
  id: string
  roomName: string
  otherUser: OtherUser
  lastMessage: LastMessage | null
  lastMessageAt: string
  createdAt: string
}

interface PlayerSearchResult {
  id: string
  summoner_name: string
  profile_icon_id?: number | null
  tier?: string | null
  main_role?: string | null
}

/* ── Page ── */

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [summonerName, setSummonerName] = useState('Player')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [creatingConvo, setCreatingConvo] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const withUserId = searchParams.get('with')

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (user) {
        const { data: playerData } = await supabase
          .from('players')
          .select('summoner_name')
          .eq('id', user.id)
          .single()

        if (playerData?.summoner_name) {
          setSummonerName(playerData.summoner_name)
        }
      }
    }
    loadUser()
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/dm')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchConversations()
    }
  }, [currentUser, fetchConversations])

  // Handle ?with= query param to auto-open/create a conversation
  const withProcessedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!withUserId || !currentUser || loading) return
    // Prevent double-processing the same withUserId
    if (withProcessedRef.current === withUserId) return
    withProcessedRef.current = withUserId

    const openOrCreateConvo = async () => {
      // Check if we already have a conversation with this user
      const existing = conversations.find(c => c.otherUser.id === withUserId)
      if (existing) {
        setActiveConvo(existing)
        router.replace('/messages', { scroll: false })
        return
      }

      // Create or get conversation via API
      setCreatingConvo(true)
      try {
        const res = await fetch('/api/dm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otherUserId: withUserId }),
        })

        if (res.ok) {
          const data = await res.json()
          const newConvo: Conversation = {
            id: data.conversation.id,
            roomName: data.conversation.roomName,
            otherUser: {
              id: data.conversation.otherUser.id,
              summonerName: data.conversation.otherUser.summonerName || data.conversation.otherUser.summoner_name || 'Player',
              profileIconId: data.conversation.otherUser.profileIconId ?? data.conversation.otherUser.profile_icon_id ?? null,
              tier: data.conversation.otherUser.tier ?? null,
              mainRole: data.conversation.otherUser.mainRole ?? data.conversation.otherUser.main_role ?? null,
            },
            lastMessage: null,
            lastMessageAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }

          if (data.created) {
            setConversations(prev => [newConvo, ...prev])
          } else {
            // Conversation already existed but wasn't in our local list — add it
            setConversations(prev => {
              if (prev.find(c => c.id === newConvo.id)) return prev
              return [newConvo, ...prev]
            })
          }
          setActiveConvo(newConvo)
        } else {
          const errData = await res.json().catch(() => ({}))
          console.error('Failed to create/get DM conversation:', res.status, errData)
        }
      } catch (err) {
        console.error('Failed to create conversation:', err)
      } finally {
        setCreatingConvo(false)
        router.replace('/messages', { scroll: false })
      }
    }

    openOrCreateConvo()
  }, [withUserId, currentUser, loading])

  // Search players
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('players')
        .select('id, summoner_name, profile_icon_id, tier, main_role')
        .ilike('summoner_name', `%${query}%`)
        .neq('id', currentUser?.id)
        .limit(10)

      setSearchResults(data || [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }, [currentUser?.id])

  // Start conversation with a search result
  const startConversation = async (player: PlayerSearchResult) => {
    setCreatingConvo(true)
    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: player.id }),
      })

      if (res.ok) {
        const data = await res.json()
        const newConvo: Conversation = {
          id: data.conversation.id,
          roomName: data.conversation.roomName,
          otherUser: {
            id: player.id,
            summonerName: player.summoner_name,
            profileIconId: player.profile_icon_id,
            tier: player.tier,
            mainRole: player.main_role,
          },
          lastMessage: null,
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }

        // Add to list if new, or find existing
        if (data.created) {
          setConversations(prev => [newConvo, ...prev])
        }
        setActiveConvo(newConvo)
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])
      }
    } catch (err) {
      console.error('Failed to start conversation:', err)
    } finally {
      setCreatingConvo(false)
    }
  }

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Not logged in
  if (!loading && !currentUser) {
    return (
      <main className="min-h-screen pt-24 pb-12 bg-[#010a13]">
        <div className="max-w-md mx-auto text-center px-4">
          <MessageSquare className="w-16 h-16 mx-auto text-slate-600 mb-6" />
          <h1 className="text-2xl font-bold text-white mb-3">Messages</h1>
          <p className="text-slate-400 mb-6">Sign in to send and receive direct messages from other players.</p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#c9aa71] text-zinc-900 font-bold rounded-lg hover:bg-[#b89961] transition"
          >
            Sign In
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className="fixed inset-x-0 bottom-0 bg-[#010a13] overflow-hidden"
      style={{ top: 'calc(var(--banner-height, 0px) + 4rem)' }}
    >
      <div className="h-full flex">
        {/* ── Conversation List (Sidebar) ── */}
        <div
          className={`${
            activeConvo ? 'hidden md:flex' : 'flex'
          } flex-col w-full md:w-[340px] lg:w-[380px] md:border-r border-slate-800/60 bg-[#0a0e16]`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-800/60">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#c9aa71]" />
                Messages
              </h1>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-lg transition ${
                  showSearch
                    ? 'bg-[#c9aa71]/20 text-[#c9aa71]'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {showSearch ? <ArrowLeft size={18} /> : <Plus size={18} />}
              </button>
            </div>

            {/* Search Bar */}
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search players..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9aa71]/50 transition"
                />
              </div>
            )}
          </div>

          {/* Search Results */}
          {showSearch && searchResults.length > 0 && (
            <div className="border-b border-slate-800/60">
              <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Players
              </p>
              {searchResults.map((player) => (
                <button
                  key={player.id}
                  onClick={() => startConversation(player)}
                  disabled={creatingConvo}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition text-left"
                >
                  <Image
                    src={player.profile_icon_id ? getProfileIconUrl(player.profile_icon_id) : cdnUrl('/default-avatar.svg')}
                    alt={player.summoner_name}
                    width={36}
                    height={36}
                    className="rounded-full border border-slate-700"
                    onError={(e) => { (e.target as HTMLImageElement).src = cdnUrl('/default-avatar.svg') }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{player.summoner_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {[player.tier, player.main_role].filter(Boolean).join(' • ') || 'Player'}
                    </p>
                  </div>
                  <MessageSquare size={14} className="text-slate-600 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <div className="px-4 py-6 text-center text-slate-500 text-sm border-b border-slate-800/60">
              No players found
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-1 p-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-slate-800 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
                      <div className="h-2.5 w-40 bg-slate-800/60 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <Users className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-400 text-sm font-medium mb-1">No conversations yet</p>
                <p className="text-slate-600 text-xs mb-4">
                  Search for a player to start chatting
                </p>
                <button
                  onClick={() => setShowSearch(true)}
                  className="px-4 py-2 bg-[#c9aa71]/20 text-[#c9aa71] text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#c9aa71]/30 transition"
                >
                  New Message
                </button>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {conversations.map((convo) => {
                  const isActive = activeConvo?.id === convo.id
                  return (
                    <button
                      key={convo.id}
                      onClick={() => setActiveConvo(convo)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition text-left ${
                        isActive
                          ? 'bg-[#c9aa71]/10 border border-[#c9aa71]/30'
                          : 'hover:bg-slate-800/40 border border-transparent'
                      }`}
                    >
                      <Image
                        src={convo.otherUser.profileIconId ? getProfileIconUrl(convo.otherUser.profileIconId) : cdnUrl('/default-avatar.svg')}
                        alt={convo.otherUser.summonerName}
                        width={44}
                        height={44}
                        className="rounded-full border border-slate-700 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = cdnUrl('/default-avatar.svg') }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-semibold truncate ${isActive ? 'text-[#c9aa71]' : 'text-white'}`}>
                            {convo.otherUser.summonerName}
                          </p>
                          {convo.lastMessage && (
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {formatRelativeTime(convo.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {convo.lastMessage
                            ? convo.lastMessage.content === 'Message deleted'
                              ? 'Message deleted'
                              : convo.lastMessage.content
                            : 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div
          className={`${
            activeConvo ? 'flex' : 'hidden md:flex'
          } flex-col flex-1 bg-[#0d1117]`}
        >
          {activeConvo ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 bg-[#0a0e16] shrink-0">
                {/* Back button (mobile only) */}
                <button
                  onClick={() => setActiveConvo(null)}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  <ArrowLeft size={20} />
                </button>
                <Image
                  src={activeConvo.otherUser.profileIconId ? getProfileIconUrl(activeConvo.otherUser.profileIconId) : cdnUrl('/default-avatar.svg')}
                  alt={activeConvo.otherUser.summonerName}
                  width={36}
                  height={36}
                  className="rounded-full border border-slate-700"
                  onError={(e) => { (e.target as HTMLImageElement).src = cdnUrl('/default-avatar.svg') }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {activeConvo.otherUser.summonerName}
                  </p>
                  {(activeConvo.otherUser.tier || activeConvo.otherUser.mainRole) && (
                    <p className="text-[11px] text-slate-500">
                      {[activeConvo.otherUser.tier, activeConvo.otherUser.mainRole].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-hidden min-h-0">
                <RealtimeChatPersistent
                  roomName={activeConvo.roomName}
                  username={summonerName}
                  enablePersistence={true}
                  showStatusBar={false}
                />
              </div>
            </>
          ) : (
            /* Empty state when no conversation selected */
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Your Messages</h2>
              <p className="text-slate-500 text-sm max-w-xs">
                Select a conversation from the sidebar or search for a player to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
