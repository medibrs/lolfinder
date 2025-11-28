import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: {
    id: string;
    slug: string;
  };
};

export default function TournamentEventLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      {/* Tournament Event Navigation will go here */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
