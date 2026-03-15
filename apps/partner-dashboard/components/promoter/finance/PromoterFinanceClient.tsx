"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, Wallet, ArrowDownRight, ArrowUpRight, Clock, Building2, Banknote, RefreshCw, Receipt } from "lucide-react";

function formatCurrencyInline(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(amount);
}

export function PromoterFinanceClient() {
    const { data, isLoading, error, refetch, isRefetching } = useQuery({
        queryKey: ["promoter", "finance"],
        queryFn: async () => {
            const res = await fetch(`/api/partner/promoter/finance`);
            if (!res.ok) throw new Error("Failed to fetch finance data");
            return res.json();
        },
    });

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <header className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-display-sm text-text-primary tracking-tight font-bold">
                        Finance
                    </h1>
                    <p className="text-text-secondary text-sm mt-1 font-medium">
                        Manage your commissions, review your ledger, and request payouts.
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                     <button 
                        onClick={() => {}}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm shadow-sm flex items-center gap-2"
                     >
                        <Banknote className="h-4 w-4" />
                        Withdraw Funds
                     </button>
                     <button 
                         onClick={() => refetch()} 
                         disabled={isRefetching || isLoading}
                         className="p-2.5 bg-surface-base border border-border-subtle hover:bg-surface-hover rounded-xl transition-colors disabled:opacity-50"
                     >
                         <RefreshCw className={`h-4 w-4 text-text-secondary ${isRefetching ? 'animate-spin' : ''}`} />
                     </button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex flex-col gap-6 w-full animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                         {[1, 2, 3].map(i => (
                             <div key={i} className="h-36 bg-surface-elevated rounded-2xl border border-border-subtle p-6 flex flex-col justify-end gap-2">
                                  <div className="w-1/2 h-4 bg-surface-tertiary rounded-md"></div>
                                  <div className="w-2/3 h-8 bg-surface-tertiary rounded-lg"></div>
                             </div>
                         ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                         <div className="lg:col-span-2 h-[400px] bg-surface-elevated rounded-2xl border border-border-subtle flex flex-col p-6 gap-6">
                              <div className="w-1/3 h-6 bg-surface-tertiary rounded-md"></div>
                              {[1,2,3,4,5].map(j => (
                                  <div key={j} className="w-full h-12 bg-surface-tertiary rounded-xl"></div>
                              ))}
                         </div>
                         <div className="h-[400px] bg-surface-elevated rounded-2xl border border-border-subtle p-6 flex flex-col gap-4">
                              <div className="w-1/2 h-6 bg-surface-tertiary rounded-md mb-2"></div>
                              <div className="w-full h-24 bg-surface-tertiary rounded-xl"></div>
                              <div className="w-full h-24 bg-surface-tertiary rounded-xl"></div>
                         </div>
                    </div>
                </div>
            ) : error || !data ? (
                <div className="w-full flex justify-center py-20 p-8 border border-red-500/20 rounded-2xl bg-red-500/5 mt-4">
                    <div className="text-center text-red-500">
                        <p className="font-bold mb-1">Failed to Load</p>
                        <p className="text-sm opacity-80">There was an error generating your finance report.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Balanced KPI Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        <div className="bg-surface-elevated border-emerald-500/30 p-6 rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-surface-elevated flex flex-col gap-2 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Wallet className="h-16 w-16 text-emerald-500" />
                             </div>
                             <p className="text-sm font-semibold text-emerald-500 flex items-center gap-2">
                                 Available Balance
                             </p>
                             <span className="text-4xl font-black tabular-nums tracking-tighter text-white mt-1">
                                 {formatCurrencyInline(data.overview.availableBalance)}
                             </span>
                             <p className="text-xs text-text-tertiary mt-2 font-medium">
                                 Ready for immediate withdrawal.
                             </p>
                        </div>

                        <div className="bg-surface-elevated border-border-subtle p-6 rounded-2xl border flex flex-col gap-2 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Clock className="h-16 w-16 text-text-muted" />
                             </div>
                             <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
                                 Pending Clearance
                             </p>
                             <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary mt-1">
                                 {formatCurrencyInline(data.overview.pendingClearance)}
                             </span>
                             <p className="text-xs text-amber-500/80 mt-2 font-medium bg-amber-500/10 self-start px-2 py-0.5 rounded">
                                 Takes ~3 days post-event to clear.
                             </p>
                        </div>

                        <div className="bg-surface-elevated border-border-subtle p-6 rounded-2xl border flex flex-col gap-2 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <DollarSign className="h-16 w-16 text-text-muted" />
                             </div>
                             <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
                                 Lifetime Earnings
                             </p>
                             <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary mt-1">
                                 {formatCurrencyInline(data.overview.lifetimeEarnings)}
                             </span>
                             <p className="text-xs text-text-tertiary mt-2 font-medium">
                                 Since joining THE C1RCLE.
                             </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                        {/* Transaction Ledger */}
                        <div className="lg:col-span-2 bg-surface-elevated rounded-2xl border border-border-subtle flex flex-col min-h-0">
                            <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-surface-base/50">
                                <h3 className="font-bold text-text-primary">Transaction Ledger</h3>
                            </div>
                            <div className="p-0 overflow-y-auto min-h-[300px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border-subtle">
                                            <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Transaction</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {data.ledger.map((tx: any) => (
                                            <tr key={tx.id} className="hover:bg-surface-hover/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                                                            tx.type === "payout" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                                                        }`}>
                                                            {tx.type === "payout" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-text-primary text-sm tracking-tight">{tx.description}</span>
                                                            <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mt-0.5">{tx.type}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-secondary">
                                                    {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                        tx.status === "cleared" || tx.status === "completed" 
                                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                    }`}>
                                                        {tx.status}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 text-right font-bold tabular-nums tracking-tight ${
                                                    tx.amount > 0 ? "text-emerald-500" : "text-text-primary"
                                                }`}>
                                                    {tx.amount > 0 ? "+" : ""}{formatCurrencyInline(tx.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                        {data.ledger.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-text-muted">
                                                    No transactions found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Payout Methods Sidebar */}
                        <div className="flex flex-col gap-4 h-full">
                             <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6">
                                 <h3 className="font-bold text-text-primary mb-4">Payout Method</h3>
                                 <div className="flex flex-col gap-3">
                                     {data.bankAccounts.map((account: any) => (
                                         <div key={account.id} className="border border-border-subtle rounded-xl p-4 bg-surface-base group relative overflow-hidden">
                                              {account.isDefault && (
                                                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg z-10">
                                                      Default
                                                  </div>
                                              )}
                                              <div className="flex items-center gap-3">
                                                  <div className="h-10 w-10 rounded-full bg-surface-tertiary flex items-center justify-center shrink-0">
                                                      <Building2 className="h-5 w-5 text-text-secondary" />
                                                  </div>
                                                  <div className="flex flex-col">
                                                      <span className="font-bold text-text-primary text-sm">{account.bankName}</span>
                                                      <span className="text-text-tertiary text-xs font-mono mt-0.5">•••• {account.last4}</span>
                                                  </div>
                                              </div>
                                         </div>
                                     ))}
                                     <button className="w-full py-3 border border-dashed border-border-subtle hover:border-emerald-500/50 hover:bg-emerald-500/5 text-emerald-500 transition-colors rounded-xl text-sm font-semibold mt-2">
                                         + Link Bank Account
                                     </button>
                                 </div>
                             </div>

                             <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 flex-1 bg-[url('/noise.png')] relative overflow-hidden group">
                                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent z-0"></div>
                                  <div className="relative z-10 h-full flex flex-col justify-center">
                                      <DollarSign className="h-8 w-8 text-emerald-500 mb-3" />
                                      <h4 className="font-bold text-text-primary mb-2">Automated Payouts</h4>
                                      <p className="text-sm text-text-secondary">
                                          Your cleared balance is automatically deposited to your default bank account on the 1st and 15th of every month.
                                      </p>
                                  </div>
                             </div>
                        </div>
                    </div>

                    {/* Commission Ledger — detailed per-ticket breakdown */}
                    <div className="bg-surface-elevated rounded-2xl border border-border-subtle flex flex-col min-h-0 w-full">
                         <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-surface-base/50">
                             <h3 className="font-bold text-text-primary flex items-center gap-2">
                                 <Receipt className="h-4 w-4 text-emerald-500" />
                                 Commission Ledger
                             </h3>
                             <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Per-Ticket Breakdown</span>
                         </div>
                         <div className="p-0 overflow-x-auto">
                             <table className="w-full text-left border-collapse min-w-[700px]">
                                 <thead>
                                     <tr className="border-b border-border-subtle bg-surface-base/30">
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Event</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Ticket Type</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Buyer</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                                         <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">Commission</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border-subtle">
                                     {(data.commissionDetails || []).map((cd: any) => (
                                         <tr key={cd.id} className="hover:bg-surface-hover/30 transition-colors">
                                             <td className="px-6 py-4 font-semibold text-text-primary text-sm">{cd.eventName}</td>
                                             <td className="px-6 py-4 text-sm text-text-secondary">
                                                 <span className="bg-surface-tertiary px-2 py-0.5 rounded-md border border-border-subtle text-xs font-medium">{cd.ticketType}</span>
                                             </td>
                                             <td className="px-6 py-4 text-sm text-text-secondary">{cd.buyerName}</td>
                                             <td className="px-6 py-4 text-sm text-text-secondary">
                                                 {new Date(cd.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                             </td>
                                             <td className="px-6 py-4">
                                                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                     cd.status === "cleared" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                 }`}>
                                                     {cd.status}
                                                 </span>
                                             </td>
                                             <td className="px-6 py-4 text-right font-bold tabular-nums text-emerald-500">+{formatCurrencyInline(cd.amount)}</td>
                                         </tr>
                                     ))}
                                     {(!data.commissionDetails || data.commissionDetails.length === 0) && (
                                         <tr>
                                             <td colSpan={6} className="px-6 py-12 text-center text-text-muted">No commission records found.</td>
                                         </tr>
                                     )}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                </>
            )}
        </div>
    );
}
