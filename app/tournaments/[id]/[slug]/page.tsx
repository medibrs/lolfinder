import { Metadata } from 'next';

type Props = {
  params: {
    id: string;
    slug: string;
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Tournament Event`,
    description: 'Tournament event page',
  };
}

export default function TournamentEventPage({ params }: Props) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Tournament Event Page</h1>
        <p className="text-gray-600 mb-8">
          Tournament ID: {params.id} | Slug: {params.slug}
        </p>
        <div className="bg-gray-100 rounded-lg p-12">
          <p className="text-lg text-gray-500">
            Tournament event page coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}
