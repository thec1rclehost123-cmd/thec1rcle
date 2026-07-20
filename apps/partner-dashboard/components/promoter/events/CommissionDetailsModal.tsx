import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Ticket, Sparkles, X, ArrowRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TicketTier {
  id: string;
  name: string;
  price: number;
  promoterEnabled: boolean;
}

interface CommissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  commissionRate: number;
  commissionType?: 'percentage' | 'fixed' | 'flat';
  token?: string;
  preloadedTickets?: TicketTier[];
}

function formatINR(rupees: number) {
  const amount = Number(rupees || 0);
  if (!amount) return '₹0';
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export default function CommissionDetailsModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  commissionRate,
  commissionType = 'percentage',
  token,
  preloadedTickets,
}: CommissionDetailsModalProps) {
  const [tickets, setTickets] = useState<TicketTier[]>(preloadedTickets || []);
  const [loading, setLoading] = useState(!preloadedTickets || preloadedTickets.length === 0);

  useEffect(() => {
    if (preloadedTickets && preloadedTickets.length > 0) {
      setTickets(preloadedTickets);
      setLoading(false);
      return;
    }
    if (!isOpen || !eventId) return;

    async function loadTickets() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/partners/promoters/events?limit=100', { headers });
        if (res.ok) {
          const data = await res.json();
          const matched = (data.events || []).find((e: any) => e.id === eventId);
          if (matched && matched.tickets) {
            setTickets(matched.tickets);
          }
        }
      } catch (e) {
        console.error('Failed to load tickets in CommissionDetailsModal:', e);
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, [isOpen, eventId, token, preloadedTickets]);

  const activeTickets = tickets.filter((t) => t.promoterEnabled !== false);
  const isFixed = commissionType === 'fixed';
  const potentialEarnings =
    activeTickets.length > 0
      ? (activeTickets.reduce((sum, ticket: any) => {
          const tRate =
            ticket.commissionRate !== undefined ? ticket.commissionRate : commissionRate;
          const tType = ticket.commissionType || commissionType;
          const tIsFixed = tType === 'fixed' || tType === 'flat';
          const estEarning = tIsFixed ? tRate : ticket.price * (tRate / 100);
          return sum + estEarning;
        }, 0) /
          activeTickets.length) *
        10
      : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-md bg-[#0A0A0C] border border-white/10 rounded-[28px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)] relative"
          >
            {/* Top brand glow line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent" />

            {/* Glowing backgrounds */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <Coins className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white tracking-tight">
                    Earnings Structure
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 flex flex-col gap-4 relative z-10">
              <div>
                <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-1">
                  Event
                </h3>
                <p className="text-[15px] font-black text-white leading-snug line-clamp-2">
                  {eventTitle}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2.5">
                  Commission Per Ticket Tier
                </h3>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="text-xs text-text-tertiary font-semibold">
                      Loading ticket payouts...
                    </span>
                  </div>
                ) : activeTickets.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {activeTickets.map((ticket: any) => {
                      const tRate =
                        ticket.commissionRate !== undefined
                          ? ticket.commissionRate
                          : commissionRate;
                      const tType = ticket.commissionType || commissionType;
                      const tIsFixed = tType === 'fixed' || tType === 'flat';
                      const estEarning = tIsFixed ? tRate : ticket.price * (tRate / 100);
                      return (
                        <div
                          key={ticket.id}
                          className="group flex items-center justify-between bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-emerald-500/25 rounded-2xl px-4 py-3 transition-all duration-300"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-3">
                            <Ticket className="w-4 h-4 text-text-tertiary group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-text-secondary truncate">
                                {ticket.name}
                              </span>
                              <span className="text-[10px] text-emerald-500/80 font-medium">
                                {tIsFixed ? `₹${tRate} flat` : `${tRate}%`} commission
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-text-tertiary bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-md">
                              {formatINR(ticket.price)}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-text-placeholder" />
                            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.08)]">
                              {formatINR(estEarning)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-text-tertiary text-center py-6 border border-dashed border-white/5 rounded-2xl">
                    No active ticket tiers found for this event.
                  </div>
                )}
              </div>

              {/* Potential Earnings Callout */}
              {!loading && potentialEarnings > 0 && (
                <div className="mt-2 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent border border-emerald-500/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
                    <span className="text-text-tertiary font-bold">
                      Earn ~{formatINR(potentialEarnings)}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-tertiary bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                    on every 10 ticket sales
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
