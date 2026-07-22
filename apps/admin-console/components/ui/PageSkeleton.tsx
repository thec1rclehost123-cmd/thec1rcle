import Skeleton from './Skeleton';

interface PageSkeletonProps {
  sections?: ('header' | 'kpi' | 'table' | 'chart')[];
}

export function PageSkeleton({ sections = ['header', 'table'] }: PageSkeletonProps) {
  return (
    <div className="space-y-10 pb-24">
      {sections.map((section) => {
        switch (section) {
          case 'header':
            return (
              <div key="header" className="space-y-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-72" />
                <Skeleton className="h-4 w-96" />
              </div>
            );
          case 'kpi':
            return (
              <div key="kpi" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08]">
                    <Skeleton className="h-12 w-12 rounded-lg mb-6" />
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
            );
          case 'chart':
            return (
              <div key="chart" className="rounded-xl border border-[#ffffff08] bg-obsidian-surface overflow-hidden p-6">
                <Skeleton className="h-4 w-32 mb-6" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            );
          case 'table':
            return (
              <div key="table" className="rounded-xl border border-[#ffffff08] bg-obsidian-surface overflow-hidden">
                <div className="p-6 border-b border-[#ffffff05]">
                  <Skeleton className="h-4 w-48" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="px-6 py-5 border-b border-[#ffffff05] flex items-center gap-4">
                    <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-16 rounded" />
                  </div>
                ))}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
