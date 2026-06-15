'use client';

import { useEffect, useState } from 'react';
import { Ticket, Wine, Sparkles, Loader2 } from 'lucide-react';

interface TierMetric {
  name: string;
  price: number;
  quantity: number;
  value: number;
  commRate: number;
  commType: string;
  commTotal: number;
  discRate: number;
  discType: string;
  discTotal: number;
  net: number;
}

interface Subtotal {
  quantity: number;
  value: number;
  discTotal: number;
  commTotal: number;
  net: number;
}

interface WizardBreakdown {
  ticketMetrics: TierMetric[];
  tableMetrics: TierMetric[];
  ticketSubtotal: Subtotal;
  tableSubtotal: Subtotal;
  grandTotal: Subtotal;
  venueSharePct: number;
  promoterSharePct: number;
}

interface DetailedBreakdownProps {
  formData: any;
}

const formatCurrency = (val: number) => '₹' + Math.round(val).toLocaleString('en-IN');

export function DetailedBreakdown({ formData }: DetailedBreakdownProps) {
  const [breakdown, setBreakdown] = useState<WizardBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/events/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setBreakdown(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData]);

  if (loading || !breakdown) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--v-text-muted)' }} />
      </div>
    );
  }

  const {
    ticketMetrics,
    tableMetrics,
    ticketSubtotal,
    tableSubtotal,
    grandTotal,
    venueSharePct,
    promoterSharePct,
  } = breakdown;

  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-black tracking-tight text-[var(--v-text-primary)]">
            Revenue & Commission Summary
          </h2>
          <p className="text-[var(--v-text-secondary)] text-[12px] font-medium mt-0.5">
            Financial breakdown based on your ticket and table configuration
          </p>
        </div>
        {formData.promotersEnabled ? (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              Promoters Enabled
            </span>
          </div>
        ) : null}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="flex h-24 flex-col justify-between rounded-[16px] border border-white/8 bg-[rgba(56,122,255,0.10)] p-4">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-black text-[#7aa2ff]">₹</div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#7aa2ff]">
              Inventory Value
            </span>
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight text-[var(--v-text-primary)]">
              {formatCurrency(grandTotal.value)}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-[#7aa2ff]/70">
              {grandTotal.quantity} units @ list price
            </p>
          </div>
        </div>

        <div className="flex h-24 flex-col justify-between rounded-[16px] border border-white/8 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-black text-emerald-300">%</div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">
              Buyer Discounts
            </span>
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight text-emerald-300">
              {formatCurrency(grandTotal.discTotal)}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-emerald-300/70">
              {grandTotal.value > 0
                ? Math.round((grandTotal.discTotal / grandTotal.value) * 100)
                : 0}
              % of inventory
            </p>
          </div>
        </div>

        <div className="flex h-24 flex-col justify-between rounded-[16px] border border-white/8 bg-[rgba(244,74,34,0.12)] p-4">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-black text-[var(--v-orange)]">↗</div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--v-orange)]">
              Promoter Pool
            </span>
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight text-[var(--v-orange)]">
              {formatCurrency(grandTotal.commTotal)}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-[rgba(244,74,34,0.7)]">
              {grandTotal.value > 0
                ? Math.round((grandTotal.commTotal / grandTotal.value) * 100)
                : 0}
              % of inventory
            </p>
          </div>
        </div>

        <div className="relative flex h-24 flex-col justify-between overflow-hidden rounded-[16px] border border-white/8 bg-[var(--v-card)] p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-surface-elevated/5 rounded-full blur-2xl -mr-6 -mt-6" />
          <div className="flex items-center gap-1.5 relative z-10">
            <Sparkles className="w-3 h-3 text-c1rcle-orange" />
            <span className="text-[9px] font-black uppercase tracking-widest text-c1rcle-orange">
              Net Revenue
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-black text-text-primary tracking-tight">
              {formatCurrency(grandTotal.net)}
            </p>
            <p className="text-[10px] text-c1rcle-orange/60 font-medium mt-0.5">
              {formatCurrency(grandTotal.net)} expected
            </p>
          </div>
        </div>
      </div>

      {/* Revenue Distribution */}
      <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-white/10">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--v-text-muted)]" />
          </div>
          <h4 className="text-[12px] font-black text-[var(--v-text-primary)]">
            Revenue Distribution
          </h4>
        </div>

        <div className="h-7 w-full rounded-lg overflow-hidden flex mb-3">
          <div
            className="h-full bg-[#34c759] flex items-center justify-center relative"
            style={{ width: `${venueSharePct}%` }}
          >
            <span className="text-[9px] font-black text-text-primary uppercase tracking-widest">
              Your Revenue
            </span>
          </div>
          <div
            className="h-full bg-[#f44a22] flex items-center justify-center relative"
            style={{ width: `${promoterSharePct}%` }}
          >
            <span className="text-[9px] font-black text-text-primary uppercase tracking-widest">
              Promoters
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
            <p className="text-[11px] font-bold text-[var(--v-text-secondary)]">
              {formatCurrency(grandTotal.net)} ({Math.round(venueSharePct)}%)
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f44a22]" />
            <p className="text-[11px] font-bold text-[var(--v-text-secondary)]">
              {formatCurrency(grandTotal.commTotal)} ({Math.round(promoterSharePct)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="overflow-hidden rounded-[20px] border border-border-default bg-[var(--v-card)]">
        <div className="grid grid-cols-12 gap-2 border-b border-white/8 bg-white/[0.02] px-6 py-3">
          <div className="col-span-2 truncate text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Item
          </div>
          <div className="col-span-1 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Price
          </div>
          <div className="col-span-1 text-center text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Qty
          </div>
          <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Value
          </div>
          <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Discount
          </div>
          <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Comm.
          </div>
          <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">
            Net
          </div>
        </div>

        <div className="text-[11px]">
          {ticketMetrics.length > 0 && (
            <>
              <div className="flex items-center gap-2 bg-[rgba(56,122,255,0.12)] px-6 py-2">
                <Ticket className="w-3 h-3 text-[#7aa2ff]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#7aa2ff]">
                  Tickets
                </span>
              </div>
              {ticketMetrics.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-2 border-b border-white/6 px-6 py-3 hover:bg-white/[0.02]"
                >
                  <div className="col-span-2">
                    <p className="break-words font-bold leading-tight text-[var(--v-text-primary)]">
                      {m.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="whitespace-nowrap text-[9px] text-[var(--v-text-muted)]">
                        {m.commRate}% comm.
                      </span>
                      {m.discRate > 0 && (
                        <span className="whitespace-nowrap text-[9px] text-emerald-300">
                          • {m.discRate}% disc.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 truncate text-right font-medium text-[var(--v-text-primary)]">
                    {formatCurrency(m.price)}
                  </div>
                  <div className="col-span-1 text-center font-medium text-[var(--v-text-muted)]">
                    {m.quantity}
                  </div>
                  <div className="col-span-2 truncate text-right font-medium text-[var(--v-text-secondary)]">
                    {formatCurrency(m.value)}
                  </div>
                  <div className="col-span-2 truncate text-right font-medium text-emerald-300">
                    {m.discTotal > 0 ? `-${formatCurrency(m.discTotal)}` : '-'}
                  </div>
                  <div className="col-span-2 truncate text-right font-medium text-[var(--v-orange)]">
                    {m.commTotal > 0 ? `-${formatCurrency(m.commTotal)}` : '-'}
                  </div>
                  <div className="col-span-2 truncate text-right font-bold text-[var(--v-text-primary)]">
                    {formatCurrency(m.net)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-12 gap-2 border-t border-white/6 bg-[rgba(56,122,255,0.08)] px-6 py-2">
                <div className="col-span-2 truncate text-[10px] font-black uppercase tracking-widest text-[#7aa2ff]">
                  Subtotal
                </div>
                <div className="col-span-1"></div>
                <div className="col-span-1 text-center text-[10px] font-bold text-[var(--v-text-primary)]">
                  {ticketSubtotal.quantity}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-secondary)]">
                  {formatCurrency(ticketSubtotal.value)}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-emerald-300">
                  {ticketSubtotal.discTotal > 0
                    ? `-${formatCurrency(ticketSubtotal.discTotal)}`
                    : '-'}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-orange)]">
                  {ticketSubtotal.commTotal > 0
                    ? `-${formatCurrency(ticketSubtotal.commTotal)}`
                    : '-'}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-primary)]">
                  {formatCurrency(ticketSubtotal.net)}
                </div>
              </div>
            </>
          )}

          {tableMetrics.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-t border-white/6 bg-[rgba(168,85,247,0.12)] px-6 py-2">
                <Wine className="w-3 h-3 text-violet-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">
                  Tables
                </span>
              </div>
              {tableMetrics.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-2 border-b border-white/6 px-6 py-3 hover:bg-white/[0.02]"
                >
                  <div className="col-span-2">
                    <p className="break-words font-bold leading-tight text-[var(--v-text-primary)]">
                      {m.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="whitespace-nowrap text-[9px] text-[var(--v-text-muted)]">
                        {m.commRate}% comm.
                      </span>
                    </div>
                  </div>
                  <div className="col-span-1 truncate text-right font-medium text-[var(--v-text-primary)]">
                    {formatCurrency(m.price)}
                  </div>
                  <div className="col-span-1 text-center font-medium text-[var(--v-text-muted)]">
                    {m.quantity}
                  </div>
                  <div className="col-span-2 truncate text-right font-medium text-[var(--v-text-secondary)]">
                    {formatCurrency(m.value)}
                  </div>
                  <div className="col-span-2 truncate text-right font-medium text-emerald-300">
                    {m.discTotal > 0 ? `-${formatCurrency(m.discTotal)}` : '-'}
                  </div>
                  <div className="col-span-2 truncate text-right font-medium text-[var(--v-orange)]">
                    {m.commTotal > 0 ? `-${formatCurrency(m.commTotal)}` : '-'}
                  </div>
                  <div className="col-span-2 truncate text-right font-bold text-[var(--v-text-primary)]">
                    {formatCurrency(m.net)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-12 gap-2 border-t border-white/6 bg-[rgba(168,85,247,0.08)] px-6 py-2">
                <div className="col-span-2 truncate text-[10px] font-black uppercase tracking-widest text-violet-300">
                  Subtotal
                </div>
                <div className="col-span-1"></div>
                <div className="col-span-1 text-center text-[10px] font-bold text-[var(--v-text-primary)]">
                  {tableSubtotal.quantity}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-secondary)]">
                  {formatCurrency(tableSubtotal.value)}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-emerald-300">
                  {tableSubtotal.discTotal > 0
                    ? `-${formatCurrency(tableSubtotal.discTotal)}`
                    : '-'}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-orange)]">
                  {tableSubtotal.commTotal > 0
                    ? `-${formatCurrency(tableSubtotal.commTotal)}`
                    : '-'}
                </div>
                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-primary)]">
                  {formatCurrency(tableSubtotal.net)}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-black px-6 py-4">
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-2 text-[10px] font-black text-text-primary uppercase tracking-widest truncate">
              Grand Total
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-1 text-center font-black text-text-primary text-xs">
              {grandTotal.quantity}
            </div>
            <div className="col-span-2 text-right font-bold text-text-primary text-xs opacity-60 truncate">
              {formatCurrency(grandTotal.value)}
            </div>
            <div className="col-span-2 text-right font-bold text-c1rcle-orange text-xs truncate">
              {grandTotal.discTotal > 0 ? `-${formatCurrency(grandTotal.discTotal)}` : '-'}
            </div>
            <div className="col-span-2 text-right font-bold text-orange-400 text-xs truncate">
              {grandTotal.commTotal > 0 ? `-${formatCurrency(grandTotal.commTotal)}` : '-'}
            </div>
            <div className="col-span-2 text-right font-black text-c1rcle-orange text-xs underline decoration-emerald-400/30 underline-offset-4 truncate">
              {formatCurrency(grandTotal.net)}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--v-text-muted)]">
          Notes:
        </p>
        <div className="space-y-1.5">
          <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
            <span className="font-bold text-[#7aa2ff]">• Inventory Value</span>= Total potential
            revenue if all inventory sells at full list price
          </p>
          <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
            <span className="font-bold text-emerald-300">• Buyer Discounts</span>= Savings provided
            to customers via promoter links (directly reduces revenue)
          </p>
          <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
            <span className="font-bold text-[var(--v-orange)]">• Promoter Pool</span>= Commission
            earned by promoters for their sales efforts
          </p>
          <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
            <span className="font-bold text-[var(--v-text-primary)]">• Net Revenue</span>= Your
            final earnings after all incentives and commissions are deducted
          </p>
        </div>
      </div>
    </div>
  );
}
