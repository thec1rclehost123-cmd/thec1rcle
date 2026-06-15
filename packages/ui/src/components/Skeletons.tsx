import React from 'react';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-white/5 ${className}`} />
);

export const EventCardSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 transition-all">
    <Skeleton className="aspect-video w-full rounded-2xl" />
    <div className="flex flex-col gap-2 p-2">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-6 w-3/4" />
      <div className="mt-2 flex items-center justify-between">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  </div>
);

export const VenueCardSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
    <Skeleton className="h-48 w-full rounded-2xl" />
    <div className="flex flex-col gap-3 p-2">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export const GridSkeleton = ({
  count = 6,
  columns = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
}: {
  count?: number;
  columns?: string;
}) => (
  <div className={`grid gap-6 ${columns}`}>
    {Array.from({ length: count }).map((_, i) => (
      <EventCardSkeleton key={i} />
    ))}
  </div>
);
