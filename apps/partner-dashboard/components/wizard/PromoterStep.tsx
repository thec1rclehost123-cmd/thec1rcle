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
    Building2
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[20px] font-bold text-[#1d1d1f]">Revenue & Commission Summary</h2>
                    <p className="text-[13px] text-[#86868b] mt-1">
                        Complete financial breakdown based on your ticket and table configuration
                    </p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${formData.promotersEnabled
                    ? "bg-[#34c759]/10 text-[#34c759]"
                    : "bg-[#86868b]/10 text-[#86868b]"
                    }`}>
                    {formData.promotersEnabled ? "✓ Promoters Enabled" : "Promoters Disabled"}
                </div>
            </div>

            {/* Grand Total Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#007aff]/5 border border-[#007aff]/10">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-[#007aff]" />
                        <p className="text-[11px] font-medium text-[#007aff] uppercase tracking-wide">Inventory Value</p>
                    </div>
                    <p className="text-[24px] font-bold text-[#1d1d1f]">₹{formatter.format(summary.faceValueRevenue)}</p>
                    <p className="text-[11px] text-[#007aff]/70">{summary.totalInventory} units @ list price</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#34c759]/5 border border-[#34c759]/10">
                    <div className="flex items-center gap-2 mb-2">
                        <Percent className="w-4 h-4 text-[#34c759]" />
                        <p className="text-[11px] font-medium text-[#34c759] uppercase tracking-wide">Buyer Discounts</p>
                    </div>
                    <p className="text-[24px] font-bold text-[#34c759]">₹{formatter.format(summary.totalDiscount)}</p>
                    <p className="text-[11px] text-[#34c759]/70">{summary.discountPercent}% of inventory value</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F44A22]/5 border border-[#F44A22]/10">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-[#F44A22]" />
                        <p className="text-[11px] font-medium text-[#F44A22] uppercase tracking-wide">Promoter Pool</p>
                    </div>
                    <p className="text-[24px] font-bold text-[#F44A22]">₹{formatter.format(summary.totalCommission)}</p>
                    <p className="text-[11px] text-[#F44A22]/70">{summary.commissionPercent}% of inventory value</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#1d1d1f] border border-[#1d1d1f]/10 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-[#34c759]" />
                        <p className="text-[11px] font-medium text-[#34c759] uppercase tracking-wide">Net Revenue</p>
                    </div>
                    <p className="text-[24px] font-bold text-white">₹{formatter.format(summary.netRevenue)}</p>
                    <p className="text-[11px] text-[#34c759] font-medium">₹{formatter.format(summary.faceValueRevenue - summary.totalDiscount - summary.totalCommission)} expected</p>
                </div>
            </div>

            {/* Revenue Split Visualization */}
            <div className="p-5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white">
                <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-[#86868b]" />
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Revenue Distribution</p>
                </div>

                <div className="h-10 rounded-xl overflow-hidden flex">
                    <div
                        className="bg-[#34c759] flex items-center justify-center transition-all"
                        style={{ width: `${100 - summary.commissionPercent}%` }}
                    >
                        <span className="text-[11px] font-bold text-white">Your Revenue</span>
                    </div>
                    <div
                        className="bg-[#F44A22] flex items-center justify-center transition-all"
                        style={{ width: `${summary.commissionPercent}%` }}
                    >
                        <span className="text-[11px] font-bold text-white">Promoters</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[#34c759]" />
                        <span className="text-[13px] text-[#1d1d1f]">₹{formatter.format(summary.netRevenue)} ({100 - summary.commissionPercent}%)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[#F44A22]" />
                        <span className="text-[13px] text-[#1d1d1f]">₹{formatter.format(summary.totalCommission)} ({summary.commissionPercent}%)</span>
                    </div>
                </div>
            </div>

            {/* Detailed Balance Sheet */}
            <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white overflow-hidden">
                <div className="p-4 border-b border-[rgba(0,0,0,0.06)] bg-[#f5f5f7]">
                    <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#86868b]" />
                        <p className="text-[13px] font-semibold text-[#1d1d1f]">Detailed Breakdown</p>
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-[#f5f5f7]/50 text-[10px] font-bold text-[#86868b] uppercase tracking-wide border-b border-[rgba(0,0,0,0.04)]">
                    <div className="col-span-2">Item</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Value</div>
                    <div className="text-right">Discount</div>
                    <div className="text-right">Comm.</div>
                    <div className="text-right">Net</div>
                </div>

                {/* Ticket Section */}
                {lineItems.filter(i => i.type === "ticket").length > 0 && (
                    <>
                        <div className="px-4 py-2 bg-[#007aff]/5 flex items-center gap-2">
                            <Ticket className="w-3.5 h-3.5 text-[#007aff]" />
                            <span className="text-[11px] font-bold text-[#007aff] uppercase tracking-wide">Tickets</span>
                        </div>
                        {lineItems.filter(i => i.type === "ticket").map((item, i) => (
                            <div key={i} className="grid grid-cols-8 gap-2 px-4 py-3 border-b border-[rgba(0,0,0,0.04)] hover:bg-[#f5f5f7]/30 transition-colors">
                                <div className="col-span-2">
                                    <p className="text-[13px] font-medium text-[#1d1d1f]">{item.name}</p>
                                    <p className="text-[10px] text-[#86868b]">
                                        {item.commissionValue}{item.commissionType === "percent" ? "%" : "₹"} comm.
                                        {item.discountValue && item.discountValue > 0 && (
                                            <span className="text-[#34c759]"> • {item.discountValue}{item.discountType === "percent" ? "%" : "₹"} disc.</span>
                                        )}
                                    </p>
                                </div>
                                <div className="text-right text-[13px] text-[#1d1d1f]">₹{formatter.format(item.price)}</div>
                                <div className="text-right text-[13px] text-[#1d1d1f]">{item.quantity}</div>
                                <div className="text-right text-[13px] text-[#1d1d1f]">₹{formatter.format(item.faceValueRevenue)}</div>
                                <div className="text-right text-[13px] text-[#34c759]">-{item.totalDiscount > 0 ? `₹${formatter.format(item.totalDiscount)}` : "₹0"}</div>
                                <div className="text-right text-[13px] text-[#F44A22]">-₹{formatter.format(item.totalCommission)}</div>
                                <div className="text-right text-[13px] font-bold text-[#1d1d1f]">₹{formatter.format(item.netRevenue)}</div>
                            </div>
                        ))}
                        {/* Ticket Subtotal */}
                        <div className="grid grid-cols-8 gap-2 px-4 py-2 bg-[#007aff]/5 text-[12px] font-semibold">
                            <div className="col-span-2 text-[#007aff]">Ticket Subtotal</div>
                            <div></div>
                            <div className="text-right text-[#1d1d1f]">{summary.ticketInventory}</div>
                            <div className="text-right text-[#1d1d1f]">₹{formatter.format(summary.ticketFaceValue)}</div>
                            <div className="text-right text-[#34c759]">-₹{formatter.format(summary.ticketDiscount)}</div>
                            <div className="text-right text-[#F44A22]">-₹{formatter.format(summary.ticketCommission)}</div>
                            <div className="text-right text-[#1d1d1f]">₹{formatter.format(summary.ticketNetRevenue)}</div>
                        </div>
                    </>
                )}

                {/* Table Section */}
                {lineItems.filter(i => i.type === "table").length > 0 && (
                    <>
                        <div className="px-4 py-2 bg-[#af52de]/5 flex items-center gap-2 mt-1">
                            <Wine className="w-3.5 h-3.5 text-[#af52de]" />
                            <span className="text-[11px] font-bold text-[#af52de] uppercase tracking-wide">Tables</span>
                        </div>
                        {lineItems.filter(i => i.type === "table").map((item, i) => (
                            <div key={i} className="grid grid-cols-8 gap-2 px-4 py-3 border-b border-[rgba(0,0,0,0.04)] hover:bg-[#f5f5f7]/30 transition-colors">
                                <div className="col-span-2">
                                    <p className="text-[13px] font-medium text-[#1d1d1f]">{item.name}</p>
                                    <p className="text-[10px] text-[#86868b]">
                                        {item.commissionValue}{item.commissionType === "percent" ? "%" : "₹"} comm.
                                        {item.totalDiscount > 0 && (
                                            <span className="text-[#34c759]"> • {item.discountValue}{item.discountType === "percent" ? "%" : "₹"} disc.</span>
                                        )}
                                    </p>
                                </div>
                                <div className="text-right text-[13px] text-[#1d1d1f]">₹{formatter.format(item.price)}</div>
                                <div className="text-right text-[13px] text-[#1d1d1f]">{item.quantity}</div>
                                <div className="text-right text-[13px] text-[#1d1d1f]">₹{formatter.format(item.faceValueRevenue)}</div>
                                <div className="text-right text-[13px] text-[#34c759]">-{item.totalDiscount > 0 ? `₹${formatter.format(item.totalDiscount)}` : "₹0"}</div>
                                <div className="text-right text-[13px] text-[#F44A22]">-₹{formatter.format(item.totalCommission)}</div>
                                <div className="text-right text-[13px] font-bold text-[#1d1d1f]">₹{formatter.format(item.netRevenue)}</div>
                            </div>
                        ))}
                        {/* Table Subtotal */}
                        <div className="grid grid-cols-8 gap-2 px-4 py-2 bg-[#af52de]/5 text-[12px] font-semibold">
                            <div className="col-span-2 text-[#af52de]">Table Subtotal</div>
                            <div></div>
                            <div className="text-right text-[#1d1d1f]">{summary.tableInventory}</div>
                            <div className="text-right text-[#1d1d1f]">₹{formatter.format(summary.tableFaceValue)}</div>
                            <div className="text-right text-[#34c759]">-₹{formatter.format(summary.tableDiscount)}</div>
                            <div className="text-right text-[#F44A22]">-₹{formatter.format(summary.tableCommission)}</div>
                            <div className="text-right text-[#1d1d1f]">₹{formatter.format(summary.tableNetRevenue)}</div>
                        </div>
                    </>
                )}

                {/* Grand Total */}
                <div className="grid grid-cols-8 gap-2 px-4 py-4 bg-[#1d1d1f] text-white text-[14px] font-bold">
                    <div className="col-span-2 uppercase tracking-wider">Grand Total</div>
                    <div></div>
                    <div className="text-right">{summary.totalInventory}</div>
                    <div className="text-right">₹{formatter.format(summary.faceValueRevenue)}</div>
                    <div className="text-right text-[#34c759]">-₹{formatter.format(summary.totalDiscount)}</div>
                    <div className="text-right text-[#F44A22]">-₹{formatter.format(summary.totalCommission)}</div>
                    <div className="text-right text-[#34c759] font-black underline decoration-2 underline-offset-4">₹{formatter.format(summary.netRevenue)}</div>
                </div>
            </div>

            {/* Summary Notes */}
            <div className="p-4 rounded-2xl bg-[#f5f5f7] space-y-2">
                <p className="text-[12px] font-medium text-[#86868b]">Notes:</p>
                <ul className="text-[11px] text-[#86868b] space-y-1 list-disc list-inside">
                    <li>Inventory Value = Total potential revenue if all inventory sells at full list price</li>
                    <li>Buyer Discounts = Savings provided to customers via promoter links (directly reduces revenue)</li>
                    <li>Promoter Pool = Commission earned by promoters for their sales efforts</li>
                    <li>Net Revenue = Your final earnings after all incentives and commissions are deducted</li>
                </ul>
            </div>

            {/* Empty State */}
            {lineItems.length === 0 && (
                <div className="p-8 rounded-2xl bg-[#f5f5f7] text-center">
                    <AlertCircle className="w-12 h-12 text-[#ff9500] mx-auto mb-4" />
                    <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2">No Items Configured</h3>
                    <p className="text-[13px] text-[#86868b] max-w-md mx-auto">
                        Go back to the Tickets and Tables steps to add items before viewing the financial summary.
                    </p>
                </div>
            )}
        </div>
    );
}
