'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { useDoorHub } from '@/lib/context/DoorHubContext';

export function DoorWalkInsView() {
  const hub = useDoorHub();
  const entries = hub?.walkInEntries ?? [];

  const totalGuests = entries.reduce((sum, e) => sum + 1, 0);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Totals strip */}
      <div
        className="rounded-2xl border px-5 py-4 flex items-center gap-6"
        style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
      >
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--v-text-tertiary)' }}
          >
            Walk-ins
          </p>
          <p
            className="text-[24px] font-black tabular-nums"
            style={{ color: 'var(--v-text-primary)' }}
          >
            {entries.length}
          </p>
        </div>
      </div>

      {/* List */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--v-border)' }}>
          <p
            className="text-[12px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--v-text-tertiary)' }}
          >
            Walk-in Entries
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="px-5 py-12 flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--v-elevated)' }}
            >
              <UserPlus size={20} className="text-[var(--v-text-muted)]" />
            </div>
            <p className="text-[13px]" style={{ color: 'var(--v-text-muted)' }}>
              No walk-in entries yet
            </p>
            <p className="text-[12px]" style={{ color: 'var(--v-text-muted)' }}>
              Use the Entry Form tab to add walk-in guests
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header row */}
            <div
              className="grid grid-cols-[1fr_110px_160px_56px_44px_88px_68px] gap-3 px-5 py-2 min-w-[720px]"
              style={{ background: 'var(--v-elevated)' }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Name
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Contact
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Email
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Gender
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Age
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Date
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-right"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Time
              </span>
            </div>
            <div className="divide-y min-w-[720px]" style={{ borderColor: 'var(--v-border)' }}>
              <AnimatePresence initial={false}>
                {entries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
                    className="grid grid-cols-[1fr_110px_160px_56px_44px_88px_68px] gap-3 px-5 py-3.5 items-center hover:bg-[var(--v-card-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[12px] font-black"
                        style={{
                          background:
                            entry.gender === 'male'
                              ? 'rgba(59,130,246,0.1)'
                              : 'rgba(236,72,153,0.1)',
                          color: entry.gender === 'male' ? '#60A5FA' : '#F472B6',
                        }}
                      >
                        {(entry.guestName[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[13px] font-semibold truncate"
                          style={{ color: 'var(--v-text-primary)' }}
                        >
                          {entry.guestName}
                        </p>
                        {entry.eventTitle && (
                          <p
                            className="text-[11px] truncate"
                            style={{ color: 'var(--v-text-muted)' }}
                          >
                            {entry.eventTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <p
                      className="text-[12px] tabular-nums truncate"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {entry.contact || '—'}
                    </p>
                    <p
                      className="text-[12px] truncate"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {entry.email || '—'}
                    </p>
                    <div className="flex justify-center">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background:
                            entry.gender === 'male'
                              ? 'rgba(59,130,246,0.1)'
                              : 'rgba(236,72,153,0.1)',
                          color: entry.gender === 'male' ? '#60A5FA' : '#F472B6',
                        }}
                      >
                        {entry.gender === 'male' ? 'M' : 'F'}
                      </span>
                    </div>
                    <p
                      className="text-[12px] tabular-nums text-center"
                      style={{ color: 'var(--v-text-secondary)' }}
                    >
                      {entry.age > 0 ? entry.age : '—'}
                    </p>
                    <p
                      className="text-[11px] tabular-nums text-center"
                      style={{ color: 'var(--v-text-muted)' }}
                    >
                      {new Date(entry.submittedAt)
                        .toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                        .toUpperCase()}
                    </p>
                    <p
                      className="text-[11px] tabular-nums text-right"
                      style={{ color: 'var(--v-text-muted)' }}
                    >
                      {new Date(entry.submittedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
