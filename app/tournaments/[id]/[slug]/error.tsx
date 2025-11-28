'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TournamentEventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Tournament event error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Something went wrong!
        </h2>
        <p className="text-gray-600 mb-8">
          {error.message || 'Unable to load tournament event. Please try again later.'}
        </p>
        
        <div className="space-x-4">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Try again
          </button>
          
          <button
            onClick={() => router.push('/tournaments')}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Back to Tournaments
          </button>
        </div>
        
        {error.digest && (
          <p className="text-sm text-gray-500 mt-8">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
