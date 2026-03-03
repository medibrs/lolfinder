import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Matches',
  description: 'Browse match pages and match details.',
  openGraph: {
    title: 'Matches | lolfinder',
    description: 'Browse match pages and match details.',
  },
}

export default function MatchesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
