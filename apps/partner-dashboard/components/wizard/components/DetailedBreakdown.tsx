"use client";

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

        // Commission
        const commRate = tier.overrideCommission
            ? (Number(tier.promoterCommission) || 0)
            : (Number(formData.commission) || 15);
        const commType = tier.overrideCommission
            ? (tier.promoterCommissionType || "percent")
            : (formData.commissionType || "percent");

        const commTotal = commType === "percent"
            ? (value * commRate / 100)
            : (commRate * quantity);

        // Discount
        let discRate = 0;
        let discType = "percent";

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

        const discTotal = discType === "percent"
            ? (value * discRate / 100)
            : (discRate * quantity);

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

    return (
        <div className="w-full max-w-[1000px] mx-auto space-y-10 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-[#1d1d1f]">
                        Revenue & Commission Summary
                    </h2>
                    <p className="text-[#86868b] text-sm font-medium">
                        Complete financial breakdown based on your ticket and table configuration
                    </p>
                </div>
                {formData.promotersEnabled ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Promoters Enabled</span>
                    </div>
                ) : null}
            </div>

            {/* Metric Cards - Exact Match to Design */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Inventory Value - Light Blue */}
                <div className="p-5 rounded-[20px] bg-[#f0f9ff] border border-blue-50/50 flex flex-col justify-between h-28">
                    <div className="flex items-center gap-1.5">
                        <div className="text-[#007aff] text-[10px] font-black">₹</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#007aff]/60">Inventory Value</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-[#1d1d1f] tracking-tight">{formatCurrency(grandTotal.value)}</p>
                        <p className="text-[10px] text-[#007aff]/60 font-bold mt-0.5">{grandTotal.quantity} units @ list price</p>
                    </div>
                </div>

                {/* Buyer Discounts - Light Green */}
                <div className="p-5 rounded-[20px] bg-[#f2fff7] border border-green-50/50 flex flex-col justify-between h-28">
                    <div className="flex items-center gap-1.5">
                        <div className="text-[#34c759] text-[10px] font-black">%</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#34c759]/60">Buyer Discounts</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-[#34c759] tracking-tight">{formatCurrency(grandTotal.discTotal)}</p>
                        <p className="text-[10px] text-[#34c759]/60 font-bold mt-0.5">{grandTotal.value > 0 ? Math.round((grandTotal.discTotal / grandTotal.value) * 100) : 0}% of inventory</p>
                    </div>
                </div>

                {/* Promoter Pool - Light Orange */}
                <div className="p-5 rounded-[20px] bg-[#fff5f2] border border-orange-50/50 flex flex-col justify-between h-28">
                    <div className="flex items-center gap-1.5">
                        <div className="text-[#f44a22] text-[10px] font-black">↗</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#f44a22]/60">Promoter Pool</span>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-[#f44a22] tracking-tight">{formatCurrency(grandTotal.commTotal)}</p>
                        <p className="text-[10px] text-[#f44a22]/60 font-bold mt-0.5">{grandTotal.value > 0 ? Math.round((grandTotal.commTotal / grandTotal.value) * 100) : 0}% of inventory</p>
                    </div>
                </div>

                {/* Net Revenue - Black */}
                <div className="p-5 rounded-[20px] bg-[#1d1d1f] flex flex-col justify-between h-28 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl -mr-6 -mt-6" />
                    <div className="flex items-center gap-1.5 relative z-10">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Net Revenue</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(grandTotal.net)}</p>
                        <p className="text-[10px] text-emerald-400/60 font-medium mt-0.5">{formatCurrency(grandTotal.net)} expected</p>
                    </div>
                </div>
            </div>

            {/* Revenue Distribution */}
            <div className="bg-white rounded-[24px] p-6 border border-[#e5e5e7] shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                    </div>
                    <h4 className="text-[13px] font-black text-[#1d1d1f]">Revenue Distribution</h4>
                </div>

                {/* Bar */}
                <div className="h-10 w-full rounded-lg overflow-hidden flex mb-4">
                    <div
                        className="h-full bg-[#34c759] flex items-center justify-center relative"
                        style={{ width: `${(grandTotal.net / (grandTotal.net + grandTotal.commTotal) || 1) * 100}%` }}
                    >
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Your Revenue</span>
                    </div>
                    <div
                        className="h-full bg-[#f44a22] flex items-center justify-center relative"
                        style={{ width: `${(grandTotal.commTotal / (grandTotal.net + grandTotal.commTotal) || 0) * 100}%` }}
                    >
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Promoters</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                        <p className="text-[11px] font-bold text-[#86868b]">{formatCurrency(grandTotal.net)} ({Math.round((grandTotal.net / (grandTotal.net + grandTotal.commTotal) || 1) * 100)}%)</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#f44a22]" />
                        <p className="text-[11px] font-bold text-[#86868b]">{formatCurrency(grandTotal.commTotal)} ({Math.round((grandTotal.commTotal / (grandTotal.net + grandTotal.commTotal) || 0) * 100)}%)</p>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-[20px] border border-[#e5e5e7] overflow-hidden shadow-sm">
                {/* Table Header Row */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-white border-b border-[#e5e5e7]">
                    <div className="col-span-2 text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Item</div>
                    <div className="col-span-1 text-right text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Price</div>
                    <div className="col-span-1 text-center text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Qty</div>
                    <div className="col-span-2 text-right text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Value</div>
                    <div className="col-span-2 text-right text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Discount</div>
                    <div className="col-span-2 text-right text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Comm.</div>
                    <div className="col-span-2 text-right text-[9px] font-black text-[#86868b] uppercase tracking-widest truncate">Net</div>
                </div>

                {/* Content */}
                <div className="text-[11px]">
                    {/* Tickets Section */}
                    {ticketMetrics.length > 0 && (
                        <>
                            <div className="px-6 py-2 bg-blue-50/30 flex items-center gap-2">
                                <Ticket className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Tickets</span>
                            </div>
                            {ticketMetrics.map((m: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-[#f5f5f7] items-center hover:bg-gray-50/50">
                                    <div className="col-span-2">
                                        <p className="font-bold text-[#1d1d1f] leading-tight break-words">{m.name}</p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            <span className="text-[9px] text-[#86868b] whitespace-nowrap">{m.commRate}% comm.</span>
                                            {(m.discRate > 0) && <span className="text-[9px] text-emerald-600 whitespace-nowrap">• {m.discRate}% disc.</span>}
                                        </div>
                                    </div>
                                    <div className="col-span-1 text-right font-medium text-[#1d1d1f] truncate">{formatCurrency(m.price)}</div>
                                    <div className="col-span-1 text-center font-medium text-[#86868b]">{m.quantity}</div>
                                    <div className="col-span-2 text-right font-medium text-[#1d1d1f] opacity-60 truncate">{formatCurrency(m.value)}</div>
                                    <div className="col-span-2 text-right font-medium text-emerald-500 truncate">{m.discTotal > 0 ? `-${formatCurrency(m.discTotal)}` : '-'}</div>
                                    <div className="col-span-2 text-right font-medium text-orange-500 truncate">{m.commTotal > 0 ? `-${formatCurrency(m.commTotal)}` : '-'}</div>
                                    <div className="col-span-2 text-right font-bold text-[#1d1d1f] truncate">{formatCurrency(m.net)}</div>
                                </div>
                            ))}
                            <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-blue-50/10 border-t border-blue-50/50">
                                <div className="col-span-2 text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">Subtotal</div>
                                <div className="col-span-1"></div>
                                <div className="col-span-1 text-center font-bold text-[#1d1d1f] text-[10px]">{ticketSubtotal.quantity}</div>
                                <div className="col-span-2 text-right font-bold text-[#1d1d1f] text-[10px] opacity-60 truncate">{formatCurrency(ticketSubtotal.value)}</div>
                                <div className="col-span-2 text-right font-bold text-emerald-500 text-[10px] truncate">{ticketSubtotal.discTotal > 0 ? `-${formatCurrency(ticketSubtotal.discTotal)}` : '-'}</div>
                                <div className="col-span-2 text-right font-bold text-orange-500 text-[10px] truncate">{ticketSubtotal.commTotal > 0 ? `-${formatCurrency(ticketSubtotal.commTotal)}` : '-'}</div>
                                <div className="col-span-2 text-right font-bold text-[#1d1d1f] text-[10px] truncate">{formatCurrency(ticketSubtotal.net)}</div>
                            </div>
                        </>
                    )}

                    {/* Tables Section */}
                    {tableMetrics.length > 0 && (
                        <>
                            <div className="px-6 py-2 bg-purple-50/30 flex items-center gap-2 border-t border-[#e5e5e7]">
                                <Wine className="w-3 h-3 text-purple-500" />
                                <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Tables</span>
                            </div>
                            {tableMetrics.map((m: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-[#f5f5f7] items-center hover:bg-gray-50/50">
                                    <div className="col-span-2">
                                        <p className="font-bold text-[#1d1d1f] leading-tight break-words">{m.name}</p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            <span className="text-[9px] text-[#86868b] whitespace-nowrap">{m.commRate}% comm.</span>
                                        </div>
                                    </div>
                                    <div className="col-span-1 text-right font-medium text-[#1d1d1f] truncate">{formatCurrency(m.price)}</div>
                                    <div className="col-span-1 text-center font-medium text-[#86868b]">{m.quantity}</div>
                                    <div className="col-span-2 text-right font-medium text-[#1d1d1f] opacity-60 truncate">{formatCurrency(m.value)}</div>
                                    <div className="col-span-2 text-right font-medium text-emerald-500 truncate">{m.discTotal > 0 ? `-${formatCurrency(m.discTotal)}` : '-'}</div>
                                    <div className="col-span-2 text-right font-medium text-orange-500 truncate">{m.commTotal > 0 ? `-${formatCurrency(m.commTotal)}` : '-'}</div>
                                    <div className="col-span-2 text-right font-bold text-[#1d1d1f] truncate">{formatCurrency(m.net)}</div>
                                </div>
                            ))}
                            <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-purple-50/10 border-t border-purple-50/50">
                                <div className="col-span-2 text-[10px] font-black text-purple-500 uppercase tracking-widest truncate">Subtotal</div>
                                <div className="col-span-1"></div>
                                <div className="col-span-1 text-center font-bold text-[#1d1d1f] text-[10px]">{tableSubtotal.quantity}</div>
                                <div className="col-span-2 text-right font-bold text-[#1d1d1f] text-[10px] opacity-60 truncate">{formatCurrency(tableSubtotal.value)}</div>
                                <div className="col-span-2 text-right font-bold text-emerald-500 text-[10px] truncate">{tableSubtotal.discTotal > 0 ? `-${formatCurrency(tableSubtotal.discTotal)}` : '-'}</div>
                                <div className="col-span-2 text-right font-bold text-orange-500 text-[10px] truncate">{tableSubtotal.commTotal > 0 ? `-${formatCurrency(tableSubtotal.commTotal)}` : '-'}</div>
                                <div className="col-span-2 text-right font-bold text-[#1d1d1f] text-[10px] truncate">{formatCurrency(tableSubtotal.net)}</div>
                            </div>
                        </>
                    )}
                </div>

                {/* Grand Total Bar - Black */}
                <div className="bg-black px-6 py-4">
                    <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2 text-[10px] font-black text-white uppercase tracking-widest truncate">Grand Total</div>
                        <div className="col-span-1"></div>
                        <div className="col-span-1 text-center font-black text-white text-xs">{grandTotal.quantity}</div>
                        <div className="col-span-2 text-right font-bold text-white text-xs opacity-60 truncate">{formatCurrency(grandTotal.value)}</div>
                        <div className="col-span-2 text-right font-bold text-emerald-400 text-xs truncate">{grandTotal.discTotal > 0 ? `-${formatCurrency(grandTotal.discTotal)}` : '-'}</div>
                        <div className="col-span-2 text-right font-bold text-orange-400 text-xs truncate">{grandTotal.commTotal > 0 ? `-${formatCurrency(grandTotal.commTotal)}` : '-'}</div>
                        <div className="col-span-2 text-right font-black text-emerald-400 text-xs underline decoration-emerald-400/30 underline-offset-4 truncate">{formatCurrency(grandTotal.net)}</div>
                    </div>
                </div>
            </div>

            {/* Simplified Notes */}
            <div className="bg-[#f5f5f7] rounded-[24px] p-6">
                <p className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest mb-3">Notes:</p>
                <div className="space-y-1.5">
                    <p className="text-[12px] text-[#86868b] flex gap-2">
                        <span className="text-[#1d1d1f] font-bold">• Inventory Value</span>
                        = Total potential revenue if all inventory sells at full list price
                    </p>
                    <p className="text-[12px] text-[#86868b] flex gap-2">
                        <span className="text-[#34c759] font-bold">• Buyer Discounts</span>
                        = Savings provided to customers via promoter links (directly reduces revenue)
                    </p>
                    <p className="text-[12px] text-[#86868b] flex gap-2">
                        <span className="text-[#f44a22] font-bold">• Promoter Pool</span>
                        = Commission earned by promoters for their sales efforts
                    </p>
                    <p className="text-[12px] text-[#86868b] flex gap-2">
                        <span className="text-[#1d1d1f] font-bold">• Net Revenue</span>
                        = Your final earnings after all incentives and commissions are deducted
                    </p>
                </div>
            </div>
        </div>
    );
}
