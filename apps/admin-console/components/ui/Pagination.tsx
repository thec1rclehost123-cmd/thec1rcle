'use client';

import { ChevronRight } from 'lucide-react';

interface PaginationProps {
  itemCount: number;
  hasMore: boolean;
  loading: boolean;
  onNext: () => void;
  onPrev: () => void;
  canGoPrev: boolean;
  label?: string;
}

export function Pagination({
  itemCount,
  hasMore,
  loading,
  onNext,
  onPrev,
  canGoPrev,
  label = 'item',
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-1 pt-2 pb-1">
      <p className="text-[11px] text-zinc-500 font-medium">
        Showing {itemCount} {label}{itemCount !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!canGoPrev || loading}
          className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={!hasMore || loading}
          className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Next <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
