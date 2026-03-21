"use client";

import { Download, Search, User, UserPlus, Users } from "lucide-react";

export function PromoterGuestListPanel({ guestlist }: { guestlist: any }) {
    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-text-primary">Guest List</h2>
                    <p className="text-sm text-text-secondary">You have used {guestlist.used} out of {guestlist.allowance} complimentary spots.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-surface-tertiary hover:bg-surface-hover text-text-primary px-4 py-2 rounded-xl font-semibold transition-colors text-sm border border-border-subtle">
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors text-sm shadow-sm">
                        <UserPlus className="h-4 w-4" />
                        Add Guest
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-surface-base p-2 border border-border-subtle rounded-full overflow-hidden mb-2">
                <div className="h-2 w-full flex bg-surface-tertiary rounded-full overflow-hidden mx-4">
                    <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${(guestlist.used / Math.max(guestlist.allowance, 1)) * 100}%` }} 
                    />
                </div>
                <div className="pr-4 whitespace-nowrap text-xs font-bold font-mono text-text-tertiary">
                    {guestlist.used} / {guestlist.allowance} SPOTS
                </div>
            </div>

            <div className="bg-surface-elevated rounded-2xl border border-border-subtle overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border-subtle bg-surface-base/50">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Search guests by name..."
                            className="w-full pl-9 pr-4 py-2 bg-surface-tertiary border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium placeholder:text-text-muted/70"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border-subtle bg-surface-base/30">
                                <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Guest Name</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Tickets</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {guestlist.guests.map((guest: any) => (
                                <tr key={guest.id} className="hover:bg-surface-hover/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-surface-tertiary flex items-center justify-center shrink-0">
                                                <User className="h-4 w-4 text-text-muted" />
                                            </div>
                                            <span className="font-semibold text-text-primary">{guest.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-sm font-medium tabular-nums text-text-secondary">
                                             <Users className="h-3.5 w-3.5 mr-1" />
                                             +{guest.tickets}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                                            {guest.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-sm text-text-tertiary hover:text-emerald-500 font-medium transition-colors opacity-0 group-hover:opacity-100">
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {guestlist.guests.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-text-muted">
                                        No guests have been added yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
