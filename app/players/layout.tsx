import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Players',
  description: 'Browse League of Legends players looking for teams. Find teammates by rank, role, and availability.',
  openGraph: {
    title: 'Find LoL Players | TeamFinder',
    description: 'Browse League of Legends players looking for teams. Find teammates by rank, role, and availability.',
  },
}

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
