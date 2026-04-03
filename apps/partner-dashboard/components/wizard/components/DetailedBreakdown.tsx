import { Ticket, Wine, Info, Sparkles } from "lucide-react";

interface DetailedBreakdownProps {
    formData: any;
}

export function DetailedBreakdown({ formData }: DetailedBreakdownProps) {
    const tickets = formData.tickets || [];
    const tables = formData.tables || [];

    const calculateTierMetrics = (tier: any, type: 'ticket' | 'table') => {
        const price = Number(tier.price) || 0;
        const quantity = Number(tier.quantity) || 0;
        const value = price * quantity;

        // For RSVP/free events or if promoters are disabled, no commission/discount
        const isRSVP = formData.isRSVP === true;
        const promotersEnabled = formData.promotersEnabled === true;
        const isFree = price === 0;

        // Commission calculation - only if promoters enabled AND price > 0
        let commTotal = 0;
        let commRate = 0;
        let commType: string = "percent";

        if (promotersEnabled && !isFree) {
            commRate = tier.overrideCommission
                ? (Number(tier.promoterCommission) || 0)
                : (Number(formData.commission) || 15);
            commType = tier.overrideCommission
                ? (tier.promoterCommissionType || "percent")
                : (formData.commissionType || "percent");

            commTotal = commType === "percent"
                ? (value * commRate / 100)
                : (commRate * quantity);
        }

        // Discount calculation - only if buyer discounts enabled AND price > 0 AND not RSVP
        let discRate = 0;
        let discType = "percent";
        let discTotal = 0;

        if (promotersEnabled && formData.buyerDiscountsEnabled && !isFree && !isRSVP) {
            if (type === 'ticket') {
                discRate = tier.overrideDiscount
                    ? (Number(tier.promoterDiscount) || 0)
                    : (Number(formData.discount) || 10);
                discType = tier.overrideDiscount
                    ? (tier.promoterDiscountType || "percent")
                    : (formData.discountType || "percent");
            } else {
                // Tables have buyerDiscountEnabled flag
                if (tier.buyerDiscountEnabled) {
                    discRate = Number(tier.promoterDiscount) || 0;
                    discType = tier.promoterDiscountType || "percent";
                }
            }

            discTotal = discType === "percent"
                ? (value * discRate / 100)
                : (discRate * quantity);
        }

        const net = value - discTotal - commTotal;

        return {
            price,
            quantity,
            value,
            commRate,
            commType,
            commTotal,
            discRate,
            discType,
            discTotal,
            net
        };
    };

    const ticketMetrics = tickets.map((t: any) => ({ ...calculateTierMetrics(t, 'ticket'), name: t.name }));
    const tableMetrics = tables.map((t: any) => ({ ...calculateTierMetrics(t, 'table'), name: t.name }));

    const ticketSubtotal = ticketMetrics.reduce((acc: any, m: any) => ({
        quantity: acc.quantity + m.quantity,
        value: acc.value + m.value,
        discTotal: acc.discTotal + m.discTotal,
        commTotal: acc.commTotal + m.commTotal,
        net: acc.net + m.net
    }), { quantity: 0, value: 0, discTotal: 0, commTotal: 0, net: 0 });

    const tableSubtotal = tableMetrics.reduce((acc: any, m: any) => ({
        quantity: acc.quantity + m.quantity,
        value: acc.value + m.value,
        discTotal: acc.discTotal + m.discTotal,
        commTotal: acc.commTotal + m.commTotal,
        net: acc.net + m.net
    }), { quantity: 0, value: 0, discTotal: 0, commTotal: 0, net: 0 });

    const grandTotal = {
        quantity: ticketSubtotal.quantity + tableSubtotal.quantity,
        value: ticketSubtotal.value + tableSubtotal.value,
        discTotal: ticketSubtotal.discTotal + tableSubtotal.discTotal,
        commTotal: ticketSubtotal.commTotal + tableSubtotal.commTotal,
        net: ticketSubtotal.net + tableSubtotal.net
    };

    const formatCurrency = (val: number) => {
        return "₹" + Math.round(val).toLocaleString('en-IN');
    };

    const revenueShareBase = grandTotal.net + grandTotal.commTotal;
    const venueShare = revenueShareBase > 0 ? (grandTotal.net / revenueShareBase) * 100 : 100;
    const promoterShare = revenueShareBase > 0 ? (grandTotal.commTotal / revenueShareBase) * 100 : 0;

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
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Promoters Enabled</span>
                    </div>
                ) : null}
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="flex h-24 flex-col justify-between rounded-[16px] border border-white/8 bg-[rgba(56,122,255,0.10)] p-4">
                    <div className="flex items-center gap-1.5">
                        <div className="text-[10px] font-black text-[#7aa2ff]">₹</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#7aa2ff]">Inventory Value</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black tracking-tight text-[var(--v-text-primary)]">{formatCurrency(grandTotal.value)}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-[#7aa2ff]/70">{grandTotal.quantity} units @ list price</p>
                    </div>
                </div>

                <div className="flex h-24 flex-col justify-between rounded-[16px] border border-white/8 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-1.5">
                        <div className="text-[10px] font-black text-emerald-300">%</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Buyer Discounts</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black tracking-tight text-emerald-300">{formatCurrency(grandTotal.discTotal)}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-emerald-300/70">{grandTotal.value > 0 ? Math.round((grandTotal.discTotal / grandTotal.value) * 100) : 0}% of inventory</p>
                    </div>
                </div>

                <div className="flex h-24 flex-col justify-between rounded-[16px] border border-white/8 bg-[rgba(244,74,34,0.12)] p-4">
                    <div className="flex items-center gap-1.5">
                        <div className="text-[10px] font-black text-[var(--v-orange)]">↗</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--v-orange)]">Promoter Pool</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black tracking-tight text-[var(--v-orange)]">{formatCurrency(grandTotal.commTotal)}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-[rgba(244,74,34,0.7)]">{grandTotal.value > 0 ? Math.round((grandTotal.commTotal / grandTotal.value) * 100) : 0}% of inventory</p>
                    </div>
                </div>

                <div className="relative flex h-24 flex-col justify-between overflow-hidden rounded-[16px] border border-white/8 bg-[var(--v-card)] p-4">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-surface-elevated/5 rounded-full blur-2xl -mr-6 -mt-6" />
                    <div className="flex items-center gap-1.5 relative z-10">
                        <Sparkles className="w-3 h-3 text-c1rcle-orange" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-c1rcle-orange">Net Revenue</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-2xl font-black text-text-primary tracking-tight">{formatCurrency(grandTotal.net)}</p>
                        <p className="text-[10px] text-c1rcle-orange/60 font-medium mt-0.5">{formatCurrency(grandTotal.net)} expected</p>
                    </div>
                </div>
            </div>

            {/* Revenue Distribution */}
            <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] p-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full border border-white/10">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--v-text-muted)]" />
                    </div>
                    <h4 className="text-[12px] font-black text-[var(--v-text-primary)]">Revenue Distribution</h4>
                </div>

                {/* Bar */}
                <div className="h-7 w-full rounded-lg overflow-hidden flex mb-3">
                    <div
                        className="h-full bg-[#34c759] flex items-center justify-center relative"
                        style={{ width: `${venueShare}%` }}
                    >
                        <span className="text-[9px] font-black text-text-primary uppercase tracking-widest">Your Revenue</span>
                    </div>
                    <div
                        className="h-full bg-[#f44a22] flex items-center justify-center relative"
                        style={{ width: `${promoterShare}%` }}
                    >
                        <span className="text-[9px] font-black text-text-primary uppercase tracking-widest">Promoters</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                        <p className="text-[11px] font-bold text-[var(--v-text-secondary)]">{formatCurrency(grandTotal.net)} ({Math.round(venueShare)}%)</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#f44a22]" />
                        <p className="text-[11px] font-bold text-[var(--v-text-secondary)]">{formatCurrency(grandTotal.commTotal)} ({Math.round(promoterShare)}%)</p>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="overflow-hidden rounded-[20px] border border-border-default bg-[var(--v-card)]">
                {/* Table Header Row */}
                <div className="grid grid-cols-12 gap-2 border-b border-white/8 bg-white/[0.02] px-6 py-3">
                    <div className="col-span-2 truncate text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Item</div>
                    <div className="col-span-1 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Price</div>
                    <div className="col-span-1 text-center text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Qty</div>
                    <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Value</div>
                    <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Discount</div>
                    <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Comm.</div>
                    <div className="col-span-2 truncate text-right text-[9px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">Net</div>
                </div>

                {/* Content */}
                <div className="text-[11px]">
                    {/* Tickets Section */}
                    {ticketMetrics.length > 0 && (
                        <>
                            <div className="flex items-center gap-2 bg-[rgba(56,122,255,0.12)] px-6 py-2">
                                <Ticket className="w-3 h-3 text-[#7aa2ff]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#7aa2ff]">Tickets</span>
                            </div>
                            {ticketMetrics.map((m: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-white/6 px-6 py-3 hover:bg-white/[0.02]">
                                    <div className="col-span-2">
                                        <p className="break-words font-bold leading-tight text-[var(--v-text-primary)]">{m.name}</p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            <span className="whitespace-nowrap text-[9px] text-[var(--v-text-muted)]">{m.commRate}% comm.</span>
                                            {(m.discRate > 0) && <span className="whitespace-nowrap text-[9px] text-emerald-300">• {m.discRate}% disc.</span>}
                                        </div>
                                    </div>
                                    <div className="col-span-1 truncate text-right font-medium text-[var(--v-text-primary)]">{formatCurrency(m.price)}</div>
                                    <div className="col-span-1 text-center font-medium text-[var(--v-text-muted)]">{m.quantity}</div>
                                    <div className="col-span-2 truncate text-right font-medium text-[var(--v-text-secondary)]">{formatCurrency(m.value)}</div>
                                    <div className="col-span-2 truncate text-right font-medium text-emerald-300">{m.discTotal > 0 ? `-${formatCurrency(m.discTotal)}` : '-'}</div>
                                    <div className="col-span-2 truncate text-right font-medium text-[var(--v-orange)]">{m.commTotal > 0 ? `-${formatCurrency(m.commTotal)}` : '-'}</div>
                                    <div className="col-span-2 truncate text-right font-bold text-[var(--v-text-primary)]">{formatCurrency(m.net)}</div>
                                </div>
                            ))}
                            <div className="grid grid-cols-12 gap-2 border-t border-white/6 bg-[rgba(56,122,255,0.08)] px-6 py-2">
                                <div className="col-span-2 truncate text-[10px] font-black uppercase tracking-widest text-[#7aa2ff]">Subtotal</div>
                                <div className="col-span-1"></div>
                                <div className="col-span-1 text-center text-[10px] font-bold text-[var(--v-text-primary)]">{ticketSubtotal.quantity}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-secondary)]">{formatCurrency(ticketSubtotal.value)}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-emerald-300">{ticketSubtotal.discTotal > 0 ? `-${formatCurrency(ticketSubtotal.discTotal)}` : '-'}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-orange)]">{ticketSubtotal.commTotal > 0 ? `-${formatCurrency(ticketSubtotal.commTotal)}` : '-'}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-primary)]">{formatCurrency(ticketSubtotal.net)}</div>
                            </div>
                        </>
                    )}

                    {/* Tables Section */}
                    {tableMetrics.length > 0 && (
                        <>
                            <div className="flex items-center gap-2 border-t border-white/6 bg-[rgba(168,85,247,0.12)] px-6 py-2">
                                <Wine className="w-3 h-3 text-violet-300" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">Tables</span>
                            </div>
                            {tableMetrics.map((m: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-white/6 px-6 py-3 hover:bg-white/[0.02]">
                                    <div className="col-span-2">
                                        <p className="break-words font-bold leading-tight text-[var(--v-text-primary)]">{m.name}</p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            <span className="whitespace-nowrap text-[9px] text-[var(--v-text-muted)]">{m.commRate}% comm.</span>
                                        </div>
                                    </div>
                                    <div className="col-span-1 truncate text-right font-medium text-[var(--v-text-primary)]">{formatCurrency(m.price)}</div>
                                    <div className="col-span-1 text-center font-medium text-[var(--v-text-muted)]">{m.quantity}</div>
                                    <div className="col-span-2 truncate text-right font-medium text-[var(--v-text-secondary)]">{formatCurrency(m.value)}</div>
                                    <div className="col-span-2 truncate text-right font-medium text-emerald-300">{m.discTotal > 0 ? `-${formatCurrency(m.discTotal)}` : '-'}</div>
                                    <div className="col-span-2 truncate text-right font-medium text-[var(--v-orange)]">{m.commTotal > 0 ? `-${formatCurrency(m.commTotal)}` : '-'}</div>
                                    <div className="col-span-2 truncate text-right font-bold text-[var(--v-text-primary)]">{formatCurrency(m.net)}</div>
                                </div>
                            ))}
                            <div className="grid grid-cols-12 gap-2 border-t border-white/6 bg-[rgba(168,85,247,0.08)] px-6 py-2">
                                <div className="col-span-2 truncate text-[10px] font-black uppercase tracking-widest text-violet-300">Subtotal</div>
                                <div className="col-span-1"></div>
                                <div className="col-span-1 text-center text-[10px] font-bold text-[var(--v-text-primary)]">{tableSubtotal.quantity}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-secondary)]">{formatCurrency(tableSubtotal.value)}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-emerald-300">{tableSubtotal.discTotal > 0 ? `-${formatCurrency(tableSubtotal.discTotal)}` : '-'}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-orange)]">{tableSubtotal.commTotal > 0 ? `-${formatCurrency(tableSubtotal.commTotal)}` : '-'}</div>
                                <div className="col-span-2 truncate text-right text-[10px] font-bold text-[var(--v-text-primary)]">{formatCurrency(tableSubtotal.net)}</div>
                            </div>
                        </>
                    )}
                </div>

                {/* Grand Total Bar - Black */}
                <div className="bg-black px-6 py-4">
                    <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2 text-[10px] font-black text-text-primary uppercase tracking-widest truncate">Grand Total</div>
                        <div className="col-span-1"></div>
                        <div className="col-span-1 text-center font-black text-text-primary text-xs">{grandTotal.quantity}</div>
                        <div className="col-span-2 text-right font-bold text-text-primary text-xs opacity-60 truncate">{formatCurrency(grandTotal.value)}</div>
                        <div className="col-span-2 text-right font-bold text-c1rcle-orange text-xs truncate">{grandTotal.discTotal > 0 ? `-${formatCurrency(grandTotal.discTotal)}` : '-'}</div>
                        <div className="col-span-2 text-right font-bold text-orange-400 text-xs truncate">{grandTotal.commTotal > 0 ? `-${formatCurrency(grandTotal.commTotal)}` : '-'}</div>
                        <div className="col-span-2 text-right font-black text-c1rcle-orange text-xs underline decoration-emerald-400/30 underline-offset-4 truncate">{formatCurrency(grandTotal.net)}</div>
                    </div>
                </div>
            </div>

            {/* Simplified Notes */}
            <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--v-text-muted)]">Notes:</p>
                <div className="space-y-1.5">
                    <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
                        <span className="font-bold text-[#7aa2ff]">• Inventory Value</span>
                        = Total potential revenue if all inventory sells at full list price
                    </p>
                    <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
                        <span className="font-bold text-emerald-300">• Buyer Discounts</span>
                        = Savings provided to customers via promoter links (directly reduces revenue)
                    </p>
                    <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
                        <span className="font-bold text-[var(--v-orange)]">• Promoter Pool</span>
                        = Commission earned by promoters for their sales efforts
                    </p>
                    <p className="flex gap-2 text-[12px] text-[var(--v-text-secondary)]">
                        <span className="font-bold text-[var(--v-text-primary)]">• Net Revenue</span>
                        = Your final earnings after all incentives and commissions are deducted
                    </p>
                </div>
            </div>
        </div>
    );
}
