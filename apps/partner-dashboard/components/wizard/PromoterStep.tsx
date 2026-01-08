"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
    Ticket,
    Wine,
    TrendingUp,
    DollarSign,
    Users,
    Percent,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    BarChart3,
    PieChart,
    Receipt,
    Wallet,
    Building2,
    Info,
    Sparkles
} from "lucide-react";

interface PromoterStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
}

interface LineItem {
    type: "ticket" | "table";
    name: string;
    price: number;
    quantity: number;
    faceValueRevenue: number; // Qty * Price
    totalDiscount: number;    // Qty * DiscountPerUnit
    totalCommission: number;  // Qty * CommissionPerUnit
    commissionType: "percent" | "amount";
    commissionValue: number;
    discountType?: "percent" | "amount";
    discountValue?: number;
    netRevenue: number;       // faceValue - discount - commission
}

export function PromoterStep({ formData, updateFormData }: PromoterStepProps) {
    // Calculate all line items for the balance sheet
    const { lineItems, summary } = useMemo(() => {
        const items: LineItem[] = [];
        const defaultCommission = formData.commission ?? 15;
        const defaultCommissionType = formData.commissionType || "percent";
        const defaultDiscount = formData.discount ?? 10;
        const defaultDiscountType = formData.discountType || "percent";

        // Process tickets
        (formData.tickets || []).forEach((ticket: any) => {
            const basePrice = Number(ticket.price) || 0;
            const quantity = Number(ticket.quantity) || 0;

            // 1. Calculate Commission Per Unit
            let commissionPerUnit = 0;
            const commissionType = formData.useDefaultCommission !== false
                ? defaultCommissionType
                : (ticket.overrideCommission ? ticket.promoterCommissionType : defaultCommissionType);
            const commissionValue = formData.useDefaultCommission !== false
                ? defaultCommission
                : (ticket.overrideCommission ? (ticket.promoterCommission ?? defaultCommission) : defaultCommission);

            if (formData.promotersEnabled && ticket.promoterEnabled) {
                if (commissionType === "percent") {
                    commissionPerUnit = Math.round((basePrice * Number(commissionValue)) / 100);
                } else {
                    commissionPerUnit = Number(commissionValue);
                }
            }

            // 2. Calculate Discount Per Unit
            let discountPerUnit = 0;
            const discountType = formData.useDefaultDiscount !== false
                ? defaultDiscountType
                : (ticket.overrideDiscount ? ticket.promoterDiscountType : defaultDiscountType);
            const discountValue = formData.useDefaultDiscount !== false
                ? defaultDiscount
                : (ticket.overrideDiscount ? (ticket.promoterDiscount ?? defaultDiscount) : defaultDiscount);

            // Discounts are disabled for RSVPs (price 0)
            if (formData.buyerDiscountsEnabled && ticket.promoterEnabled && !formData.isRSVP && basePrice > 0) {
                if (discountType === "percent") {
                    discountPerUnit = Math.round((basePrice * Number(discountValue)) / 100);
                } else {
                    discountPerUnit = Number(discountValue);
                }
            }

            const faceValueRevenue = basePrice * quantity;
            const totalDiscount = discountPerUnit * quantity;
            const totalCommission = commissionPerUnit * quantity;
            const netRevenue = faceValueRevenue - totalDiscount - totalCommission;

            items.push({
                type: "ticket",
                name: ticket.name || "Unnamed Ticket",
                price: basePrice,
                quantity,
                faceValueRevenue,
                totalDiscount,
                totalCommission,
                commissionType,
                commissionValue: Number(commissionValue),
                discountType,
                discountValue: Number(discountValue),
                netRevenue
            });
        });

        // Process tables - Tables have their own commission settings (not override pattern like tickets)
        (formData.tables || []).forEach((table: any) => {
            const basePrice = Number(table.price) || 0;
            const quantity = Number(table.quantity) || 0;

            // 1. Calculate Commission Per Unit
            // Tables use their own promoterCommission/Type if set, otherwise fall back to event defaults
            let commissionPerUnit = 0;
            const tableHasCustomCommission = table.promoterCommission !== undefined && table.promoterCommission !== "" && table.promoterCommission !== null;
            const commissionType = tableHasCustomCommission
                ? (table.promoterCommissionType || "percent")
                : defaultCommissionType;
            const commissionValue = tableHasCustomCommission
                ? Number(table.promoterCommission)
                : defaultCommission;

            // Only calculate if both event-level promoters AND this table has promoter sales enabled
            if (formData.promotersEnabled && table.promoterEnabled) {
                if (commissionType === "percent") {
                    commissionPerUnit = Math.round((basePrice * commissionValue) / 100);
                } else {
                    commissionPerUnit = commissionValue;
                }
            }

            // 2. Calculate Discount Per Unit - Tables use their own buyerDiscountEnabled toggle
            let discountPerUnit = 0;
            const tableHasCustomDiscount = table.promoterDiscount !== undefined && table.promoterDiscount !== "" && table.promoterDiscount !== null;
            const discountType = tableHasCustomDiscount
                ? (table.promoterDiscountType || "percent")
                : defaultDiscountType;
            const discountValue = tableHasCustomDiscount
                ? Number(table.promoterDiscount)
                : defaultDiscount;

            // Tables have their own buyerDiscountEnabled toggle (independent from event-level setting)
            // Only apply discount if: promoters enabled, table promoter enabled, table discount enabled, not RSVP, has price
            if (formData.promotersEnabled && table.promoterEnabled && table.buyerDiscountEnabled && !formData.isRSVP && basePrice > 0) {
                if (discountType === "percent") {
                    discountPerUnit = Math.round((basePrice * discountValue) / 100);
                } else {
                    discountPerUnit = discountValue;
                }
            }

            const faceValueRevenue = basePrice * quantity;
            const totalDiscount = discountPerUnit * quantity;
            const totalCommission = commissionPerUnit * quantity;
            const netRevenue = faceValueRevenue - totalDiscount - totalCommission;

            items.push({
                type: "table",
                name: table.name || "Unnamed Table",
                price: basePrice,
                quantity,
                faceValueRevenue,
                totalDiscount,
                totalCommission,
                commissionType,
                commissionValue: commissionValue,
                discountType,
                discountValue: discountValue,
                netRevenue
            });
        });

        // Calculate summary
        const summary = {
            totalInventory: items.reduce((s, i) => s + i.quantity, 0),
            faceValueRevenue: items.reduce((s, i) => s + i.faceValueRevenue, 0),
            totalDiscount: items.reduce((s, i) => s + (i.totalDiscount || 0), 0),
            totalCommission: items.reduce((s, i) => s + i.totalCommission, 0),
            grossRevenue: items.reduce((s, i) => s + (i.faceValueRevenue - (i.totalDiscount || 0)), 0),
            netRevenue: items.reduce((s, i) => s + i.netRevenue, 0),

            // Subtotals
            ticketInventory: items.filter(i => i.type === "ticket").reduce((s, i) => s + i.quantity, 0),
            ticketFaceValue: items.filter(i => i.type === "ticket").reduce((s, i) => s + i.faceValueRevenue, 0),
            ticketCommission: items.filter(i => i.type === "ticket").reduce((s, i) => s + i.totalCommission, 0),
            ticketDiscount: items.filter(i => i.type === "ticket").reduce((s, i) => s + (i.totalDiscount || 0), 0),
            ticketNetRevenue: items.filter(i => i.type === "ticket").reduce((s, i) => s + i.netRevenue, 0),

            tableInventory: items.filter(i => i.type === "table").reduce((s, i) => s + i.quantity, 0),
            tableFaceValue: items.filter(i => i.type === "table").reduce((s, i) => s + i.faceValueRevenue, 0),
            tableCommission: items.filter(i => i.type === "table").reduce((s, i) => s + i.totalCommission, 0),
            tableDiscount: items.filter(i => i.type === "table").reduce((s, i) => s + (i.totalDiscount || 0), 0),
            tableNetRevenue: items.filter(i => i.type === "table").reduce((s, i) => s + i.netRevenue, 0),

            // Helpful percentages
            commissionPercent: items.reduce((s, i) => s + i.faceValueRevenue, 0) > 0
                ? Math.round((items.reduce((s, i) => s + i.totalCommission, 0) / items.reduce((s, i) => s + i.faceValueRevenue, 0)) * 100)
                : 0,
            discountPercent: items.reduce((s, i) => s + i.faceValueRevenue, 0) > 0
                ? Math.round((items.reduce((s, i) => s + (i.totalDiscount || 0), 0) / items.reduce((s, i) => s + i.faceValueRevenue, 0)) * 100)
                : 0
        };

        return { lineItems: items, summary };
    }, [
        formData.tickets,
        formData.tables,
        formData.commission,
        formData.commissionType,
        formData.promotersEnabled,
        formData.useDefaultCommission,
        formData.buyerDiscountsEnabled,
        formData.useDefaultDiscount,
        formData.discount,
        formData.discountType,
        formData.isRSVP
    ]);

    const formatter = new Intl.NumberFormat('en-IN');

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-headline">Sales & Insights</h2>
                        <p className="text-label mt-1">
                            Complete financial projection & commission modeling
                        </p>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${formData.promotersEnabled
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "surface-secondary text-muted border-default"
                    }`}>
                    {formData.promotersEnabled ? "✓ Active Pipeline" : "Pipeline Idle"}
                </div>
            </div>

            {/* Grand Total Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card-elevated p-6 space-y-4 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <p className="text-label uppercase tracking-widest text-blue-600">Scale</p>
                    </div>
                    <div>
                        <p className="text-stat font-black tracking-tight">₹{formatter.format(summary.faceValueRevenue)}</p>
                        <p className="text-body-sm text-muted mt-1">{summary.totalInventory} total units</p>
                    </div>
                </div>

                <div className="card-elevated p-6 space-y-4 border-l-4 border-l-teal-500">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                            <Percent className="w-4 h-4" />
                        </div>
                        <p className="text-label uppercase tracking-widest text-teal-600">Incentives</p>
                    </div>
                    <div>
                        <p className="text-stat font-black tracking-tight">₹{formatter.format(summary.totalDiscount)}</p>
                        <p className="text-body-sm text-muted mt-1">{summary.discountPercent}% market discount</p>
                    </div>
                </div>

                <div className="card-elevated p-6 space-y-4 border-l-4 border-l-rose-500">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                        <p className="text-label uppercase tracking-widest text-rose-600">Network</p>
                    </div>
                    <div>
                        <p className="text-stat font-black tracking-tight">₹{formatter.format(summary.totalCommission)}</p>
                        <p className="text-body-sm text-muted mt-1">{summary.commissionPercent}% network fee</p>
                    </div>
                </div>

                <div className="rounded-[2rem] p-6 space-y-4 bg-stone-900 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <Wallet className="w-20 h-20" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 text-emerald-400 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <p className="text-label uppercase tracking-widest text-stone-400">Net Yield</p>
                    </div>
                    <div>
                        <p className="text-stat font-black tracking-tight text-white">₹{formatter.format(summary.netRevenue)}</p>
                        <p className="text-body-sm text-stone-400 mt-1">Est. realization</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Split Visualization */}
                <div className="card-elevated p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
                                <PieChart className="w-4 h-4" />
                            </div>
                            <h3 className="text-headline-sm">Yield Analysis</h3>
                        </div>
                    </div>

                    <div className="h-14 rounded-2xl overflow-hidden flex shadow-inner bg-stone-100 p-1">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${100 - summary.commissionPercent - summary.discountPercent}%` }}
                            className="h-full bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg"
                        >
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Yield</span>
                        </motion.div>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${summary.discountPercent}%` }}
                            className="h-full bg-teal-400 flex items-center justify-center"
                        >
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Disc.</span>
                        </motion.div>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${summary.commissionPercent}%` }}
                            className="h-full bg-rose-500 rounded-r-xl flex items-center justify-center"
                        >
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter">Comm.</span>
                        </motion.div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-2xl surface-secondary border border-default">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-body-sm font-bold">Venue Retention</span>
                            </div>
                            <span className="text-body-sm font-black">₹{formatter.format(summary.netRevenue)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-2xl surface-secondary border border-default">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                <span className="text-body-sm font-bold">Network Fees</span>
                            </div>
                            <span className="text-body-sm font-black">₹{formatter.format(summary.totalCommission)}</span>
                        </div>
                    </div>
                </div>

                {/* Detailed Balance Sheet */}
                <div className="lg:col-span-2 card-elevated overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-default bg-stone-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
                                <Receipt className="w-4 h-4" />
                            </div>
                            <h3 className="text-headline-sm">Inventory Ledger</h3>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-default bg-stone-50/30">
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted">Item Description</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted">Metrics</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted">Facial</th>
                                    <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted">Retention</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {lineItems.map((item, i) => (
                                    <tr key={i} className="hover:bg-stone-50/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'ticket' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {item.type === 'ticket' ? <Ticket className="w-4 h-4" /> : <Wine className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-body font-bold">{item.name}</p>
                                                    <p className="text-[11px] text-muted">
                                                        {item.commissionValue}{item.commissionType === "percent" ? "%" : "₹"} comm.
                                                        {item.discountValue > 0 && <span className="text-emerald-600"> • {item.discountValue}{item.discountType === "percent" ? "%" : "₹"} disc.</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-right">
                                            <p className="text-body-sm font-medium">₹{formatter.format(item.price)}</p>
                                            <p className="text-[11px] text-muted">× {item.quantity} units</p>
                                        </td>
                                        <td className="px-4 py-5 text-right">
                                            <p className="text-body-sm font-bold">₹{formatter.format(item.faceValueRevenue)}</p>
                                        </td>
                                        <td className="px-4 py-5 text-right">
                                            <p className="text-body-sm font-black text-emerald-600">₹{formatter.format(item.netRevenue)}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-stone-900 text-white">
                                    <td className="px-6 py-5 rounded-bl-[2.5rem]">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Projected Aggregate</p>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <p className="text-body-sm font-bold">{summary.totalInventory} Units</p>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <p className="text-body-sm font-bold text-stone-300">₹{formatter.format(summary.faceValueRevenue)}</p>
                                    </td>
                                    <td className="px-4 py-5 text-right rounded-br-[2.5rem]">
                                        <p className="text-stat-sm font-black text-emerald-400">₹{formatter.format(summary.netRevenue)}</p>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {lineItems.length === 0 && (
                <div className="p-16 rounded-[3rem] surface-secondary border border-default text-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <h3 className="text-display-sm mb-2">Ledger Inactive</h3>
                    <p className="text-body text-secondary max-w-md mx-auto">
                        Please configure your tickets and table inventory in the previous steps to visualize your revenue matrix.
                    </p>
                </div>
            )}

            {/* Strategic Notes */}
            <div className="card p-8 border-l-4 border-l-stone-600 bg-stone-50/30 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-stone-400 shrink-0">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-body font-bold mb-1">Valuation Logic</h4>
                        <p className="text-body-sm text-muted leading-relaxed">
                            Inventory value represents your maximum upside. Net revenue factors in all market incentives and platform distribution fees.
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-400 shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-body font-bold mb-1">Strategic Realization</h4>
                        <p className="text-body-sm text-muted leading-relaxed">
                            These figures are projections based on 100% sell-out. In-app analytics will track actual realization in real-time post-publish.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
