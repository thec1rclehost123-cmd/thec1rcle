'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, Upload } from 'lucide-react';
import type { SyncState } from '@/lib/client/offlineGuestSync';

interface OfflineSyncBannerProps {
  syncState: SyncState;
  onForceSync: () => void;
}

export function OfflineSyncBanner({ syncState, onForceSync }: OfflineSyncBannerProps) {
  const isOffline = syncState.status === 'offline';
  const isError = syncState.status === 'error';
  const isSyncing = syncState.status === 'syncing';
  const hasQueue = syncState.queuedCount > 0;

  // Only show banner when relevant
  const visible = isOffline || isError || hasQueue;

  const formatTime = (iso: string | null) => {
    if (!iso) return 'never';
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return 'just now';
    if (diffMs < 3600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Status strip — always visible at top */}
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
        {isSyncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
            <span className="text-blue-400">Syncing guestlist…</span>
          </>
        ) : isOffline ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-amber-400">Offline — showing cached guestlist</span>
          </>
        ) : isError ? (
          <>
            <CloudOff className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-red-400">Sync error: {syncState.error}</span>
          </>
        ) : (
          <>
            <Cloud className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <span className="text-zinc-500">
              {syncState.totalGuests} guests · synced {formatTime(syncState.lastSynced)}
            </span>
          </>
        )}

        {hasQueue && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="flex items-center gap-1 text-amber-400">
              <Upload className="h-3 w-3" />
              {syncState.queuedCount} check-in{syncState.queuedCount !== 1 ? 's' : ''} pending
              upload
            </span>
          </>
        )}

        <button
          onClick={onForceSync}
          disabled={isSyncing}
          className="ml-auto text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
          title="Force sync"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Offline overlay banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <WifiOff className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-300">You're offline</p>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  Guestlist is read from local cache. Check-ins will be queued and uploaded
                  automatically when you reconnect.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
