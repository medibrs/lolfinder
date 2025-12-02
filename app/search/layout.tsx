import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Search Players',
  description: 'Search for League of Legends players by rank, role, region, and availability. Find the perfect teammates.',
  openGraph: {
    title: 'Search LoL Players | TeamFinder',
    description: 'Search for League of Legends players by rank, role, region, and availability. Find the perfect teammates.',
  },
}

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
