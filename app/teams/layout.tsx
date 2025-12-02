import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Teams',
  description: 'Find League of Legends teams looking for players. Join a team that matches your rank, role, and playstyle.',
  openGraph: {
    title: 'Find LoL Teams | TeamFinder',
    description: 'Find League of Legends teams looking for players. Join a team that matches your rank, role, and playstyle.',
  },
}

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
