'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { PromoCodeInput } from '../../../components/checkout/PromoCodeInput';
import NeedToKnowCard from '../../../components/checkout/NeedToKnowCard';

export default function CheckoutSummaryPanel({
  appliedPromoCode,
  displayFees,
  displaySubtotal,
  displayTotal,
  event,
  feeBreakdown,
  feesBreakdownOpen,
  handleApplyPromoCode,
  handleRemovePromoCode,
  needToKnowItems,
  selectedTickets,
  setFeesBreakdownOpen,
  totalDiscount,
}) {
  return (
    <div className="hidden md:flex flex-col h-fit overflow-hidden rounded-[42px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="relative h-44 shrink-0">
        <Image
          src={event.image || '/events/placeholder.jpg'}
          alt={event.title}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-6 left-7 right-7">
          <div className="mb-3 inline-flex items-center rounded-full border border-orange/18 bg-orange/15 px-3 py-1">
            <p className="text-[7px] font-black uppercase tracking-[0.3em] text-orange">
              Booking Summary
            </p>
          </div>
          <h3 className="text-[26px] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
            {event.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-col flex-1 px-7 pb-7 pt-6">
        <div className="rounded-[28px] border border-white/5 bg-black/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="space-y-3 overflow-y-auto custom-scrollbar">
            {selectedTickets.length > 0 ? (
              selectedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-start justify-between gap-4 border-b border-white/4 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-[13px] font-black uppercase tracking-[0.08em] text-white">
                      {ticket.name}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/28">
                      {ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-[18px] font-black tracking-tight text-white">
                    {ticket.displayLineTotal || `₹${ticket.price.toLocaleString('en-IN')}`}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-[10px] font-black uppercase tracking-[0.34em] text-white/16">
                Empty Order
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <PromoCodeInput
            eventId={event.id}
            onApply={handleApplyPromoCode}
            appliedCode={appliedPromoCode}
            onRemove={handleRemovePromoCode}
            className="[&_input]:h-14 [&_input]:rounded-[22px] [&_input]:border-white/5 [&_input]:bg-white/[0.04] [&_input]:text-white [&_input]:placeholder:text-white/22"
          />
        </div>

        <NeedToKnowCard items={needToKnowItems} className="mt-5" />

        <div className="mt-6 rounded-[30px] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Subtotal
              </span>
              <span className="text-[13px] font-semibold text-white/68">
                ₹{displaySubtotal.toLocaleString('en-IN')}
              </span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-green-400/80">
                  {appliedPromoCode ? `Promo (${appliedPromoCode})` : 'Discount'}
                </span>
                <span className="text-[13px] font-semibold text-green-400">
                  -₹{totalDiscount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {displayFees > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setFeesBreakdownOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-[20px] border border-white/5 bg-white/[0.025] px-3.5 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                    Fees & GST
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${feesBreakdownOpen ? 'rotate-180' : ''}`}
                    />
                  </span>
                  <span className="text-[13px] font-semibold text-white/72">
                    +₹
                    {displayFees.toLocaleString('en-IN', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {feesBreakdownOpen && feeBreakdown.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      className="overflow-hidden rounded-[20px] border border-white/5 bg-white/[0.03]"
                    >
                      <div className="space-y-2 p-3">
                        {feeBreakdown.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                              {item.label}
                            </span>
                            <span className="text-[12px] font-semibold text-white/70">
                              ₹
                              {item.value.toLocaleString('en-IN', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="mt-4 flex items-end justify-between border-t border-white/6 pt-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/34">
                  Total
                </p>
                <p className="mt-1 text-[11px] text-white/32">
                  Inclusive of all confirmed charges.
                </p>
              </div>
              <div className="text-right">
                {displayTotal !== null ? (
                  <p className="text-[44px] font-black leading-none tracking-[-0.05em] text-white">
                    ₹{displayTotal.toLocaleString('en-IN')}
                  </p>
                ) : (
                  <p className="text-[44px] font-black leading-none tracking-[-0.05em] text-white/30">
                    —
                  </p>
                )}
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.36em] text-white/22">
                  Grand Total
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-white/4 bg-white/[0.03] px-3 py-2">
              <ShieldCheck className="h-3 w-3 text-white/26" />
              <span className="text-[8px] font-black uppercase tracking-[0.28em] text-white/24">
                End-to-End Encrypted
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
