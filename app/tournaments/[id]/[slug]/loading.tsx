import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function TournamentEventLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Tournament Banner Skeleton */}
      <div className="relative h-48 md:h-64 rounded-xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-zinc-900">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="relative h-full flex flex-col justify-end p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="h-6 w-20 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 md:h-10 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          
          {/* Tournament Details Bar Skeleton */}
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 mt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content skeleton */}
        <div className="lg:col-span-2 space-y-6">
          {/* Empty Tournament Details Card */}
          <Card className="border-zinc-800">
            <div className="p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/4 mb-4"></div>
              <div className="text-center py-8">
                <Skeleton className="h-12 w-12 mx-auto mb-2" />
                <Skeleton className="h-4 w-48 mx-auto" />
                <Skeleton className="h-3 w-32 mx-auto mt-1" />
              </div>
            </div>
          </Card>
          
          {/* Teams Attending Card */}
          <Card className="border-zinc-800">
            <div className="p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="relative rounded-lg border border-zinc-700/50 overflow-hidden h-40">
                    <Skeleton className="w-full h-full" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
        
        {/* Sidebar skeleton */}
        <div className="space-y-6">
          <Card className="border-zinc-800">
            <div className="p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <Skeleton className="h-4 bg-zinc-700 rounded" />
                <Skeleton className="h-4 bg-zinc-700 rounded w-5/6" />
                <Skeleton className="h-4 bg-zinc-700 rounded w-4/6" />
              </div>
            </div>
          </Card>
          
          <Card className="border-zinc-800">
            <div className="p-6">
              <div className="h-6 bg-zinc-700 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <Skeleton className="h-3 bg-zinc-700 rounded" />
                <Skeleton className="h-3 bg-zinc-700 rounded w-4/5" />
                <Skeleton className="h-3 bg-zinc-700 rounded w-3/5" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
