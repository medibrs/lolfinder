export default function TournamentEventLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse">
        <div className="h-8 bg-zinc-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-zinc-700 rounded w-1/2 mb-8"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content skeleton */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-zinc-700 rounded"></div>
                <div className="h-4 bg-zinc-700 rounded w-5/6"></div>
                <div className="h-4 bg-zinc-700 rounded w-4/6"></div>
              </div>
            </div>
            
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="h-32 bg-zinc-700 rounded"></div>
                <div className="h-32 bg-zinc-700 rounded"></div>
                <div className="h-32 bg-zinc-700 rounded"></div>
                <div className="h-32 bg-zinc-700 rounded"></div>
              </div>
            </div>
          </div>
          
          {/* Sidebar skeleton */}
          <div className="space-y-6">
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-zinc-700 rounded"></div>
                <div className="h-4 bg-zinc-700 rounded w-5/6"></div>
                <div className="h-4 bg-zinc-700 rounded w-4/6"></div>
              </div>
            </div>
            
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-zinc-700 rounded"></div>
                <div className="h-3 bg-zinc-700 rounded w-4/5"></div>
                <div className="h-3 bg-zinc-700 rounded w-3/5"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
