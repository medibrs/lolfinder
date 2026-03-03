export function slugify(value: string, fallback = 'item'): string {
  const normalized = (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return normalized || fallback
}

export function getTournamentPath(id: string | number, name: string): string {
  return `/tournaments/${id}/${slugify(name, 'tournament')}`
}

interface MatchPathInput {
  id: string | number
  team1Name?: string | null
  team2Name?: string | null
  contextName?: string | null
}

export function getCompactMatchRouteId(id: string | number): string {
  const raw = String(id)
  const uuidPrefix = raw.match(/^[a-f0-9]{8}-/i)
  if (uuidPrefix) return raw.slice(0, 8)
  if (raw.length > 12) return raw.slice(0, 8)
  return raw
}

export function buildMatchSlug({ team1Name, team2Name, contextName }: Omit<MatchPathInput, 'id'>): string {
  const left = team1Name?.trim() || 'team-1'
  const right = team2Name?.trim() || 'team-2'
  const context = contextName?.trim() || 'tournament'

  return slugify(`${left} vs ${right} ${context}`, 'tournament-match')
}

export function getMatchPath({ id, team1Name, team2Name, contextName }: MatchPathInput): string {
  const slug = buildMatchSlug({ team1Name, team2Name, contextName })
  return `/matches/${getCompactMatchRouteId(id)}/${slug}`
}
