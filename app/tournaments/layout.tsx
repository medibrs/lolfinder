import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tournaments',
  description: 'Browse and join competitive League of Legends tournaments. Compete with your team for prizes and glory.',
  openGraph: {
    title: 'LoL Tournaments | TeamFinder',
    description: 'Browse and join competitive League of Legends tournaments. Compete with your team for prizes and glory.',
  },
}

export default function TournamentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
