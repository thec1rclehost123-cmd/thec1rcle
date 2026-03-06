"use client";

import { useState } from "react";
import {
    Banknote,
    ArrowUpRight,
    Download,
    Clock,
    CheckCircle2,
    AlertCircle,
    History,
    Search,
    Filter,
    ArrowDownRight,
    CreditCard
} from "lucide-react";
import { motion } from "framer-motion";

export default function PayoutsPage() {
    const [payouts] = useState([
        { id: "PY-88219", amount: 68400, date: "2026-01-25", status: "completed", account: "HDFC •••• 8821" },
        { id: "PY-88104", amount: 42100, date: "2026-01-18", status: "completed", account: "HDFC •••• 8821" },
        { id: "PY-88002", amount: 125000, date: "2026-01-11", status: "completed", account: "HDFC •••• 8821" },
        { id: "PY-87941", amount: 35600, date: "2026-01-04", status: "failed", account: "ICICI •••• 1102" },
    ]);

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-text-primary tracking-tight flex items-center gap-4">
                        <Banknote className="w-10 h-10" />
                        Payouts & Revenue
                    </h1>
                    <p className="text-text-tertiary text-sm font-medium mt-2 uppercase tracking-widest">Tracking your earnings and bank transfers</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="btn btn-secondary">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                    <button className="btn btn-primary">
                        Settlement Help
                    </button>
                </div>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-secondary p-8 rounded-[2.5rem] text-text-primary">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] mb-4">Current Balance</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-4xl font-black tracking-tight">₹48,200</h2>
                        <span className="text-[10px] font-black text-c1rcle-orange uppercase tracking-widest">Settling in 2d</span>
                    </div>
                </div>

                <div className="bg-surface-elevated p-8 rounded-[2.5rem] border border-border-subtle shadow-sm">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.2em] mb-4">Total Settled (Jan)</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-4xl font-black text-text-primary tracking-tight">₹2,35,500</h2>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">+12% vs Dec</span>
                    </div>
                </div>

                <div className="bg-surface-elevated p-8 rounded-[2.5rem] border border-border-subtle shadow-sm">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.2em] mb-4">Active Bank Account</p>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-tertiary rounded-xl flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-text-tertiary" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-text-primary">HDFC BANK LTD</p>
                            <p className="text-[10px] font-medium text-text-tertiary">•••• 8821</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payout History */}
            <div className="bg-surface-elevated rounded-[2.5rem] border border-border-subtle shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4 text-text-placeholder" />
                        Transfer History
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-placeholder" />
                            <input type="text" placeholder="Search by ID..." className="pl-9 pr-4 py-2 bg-surface-tertiary border-none rounded-xl text-[11px] font-medium w-48 focus:ring-1 focus:ring-indigo-100 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface-tertiary/50 text-left">
                                <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Payout ID</th>
                                <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Date</th>
                                <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Amount</th>
                                <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Destination</th>
                                <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-right">Invoice</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {payouts.map((p) => (
                                <tr key={p.id} className="group hover:bg-surface-tertiary/50 transition-all">
                                    <td className="px-8 py-6">
                                        <span className="text-xs font-bold text-text-primary">#{p.id}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-xs font-bold text-text-tertiary">
                                            <Clock className="w-3.5 h-3.5" />
                                            {p.date}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="text-sm font-black text-text-primary">₹{p.amount.toLocaleString()}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="text-[10px] font-black text-text-tertiary uppercase tracking-widest bg-surface-tertiary px-2 py-1 rounded">{p.account}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            {p.status === 'completed' ? (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                    Settled
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-100">
                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                    Retrying
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button className="p-2 text-text-placeholder hover:text-indigo-500 transition-colors">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
