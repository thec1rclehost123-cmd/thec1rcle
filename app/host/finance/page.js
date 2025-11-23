"use client";

import { Wallet, Download, TrendingUp, ArrowUpRight, DollarSign, CreditCard } from "lucide-react";
import { MetricCard, StudioCard, RevenueChart } from "../../../components/host/StudioComponents";

export default function FinancePage() {
    return (
        <div className="max-w-[1800px] mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-1">Finance</h1>
                    <p className="text-[#888] text-sm font-medium">Track revenue, payouts, and transactions.</p>
                </div>
                <button className="px-6 py-3 bg-white/[0.03] border border-white/[0.05] text-white rounded-full text-xs font-bold hover:bg-white/[0.08] transition-colors flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export Report
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard title="Total Revenue" value="₹12.4L" change="+18%" icon={Wallet} delay={0.1} />
                <MetricCard title="Pending Payout" value="₹45,200" change="Processing" icon={TrendingUp} delay={0.2} />
                <MetricCard title="Avg. Ticket Price" value="₹850" change="+5%" icon={CreditCard} delay={0.3} />
            </div>

            {/* Main Chart */}
            <StudioCard className="min-h-[500px]" delay={0.4}>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-white">Revenue History</h3>
                        <p className="text-xs text-[#666] font-medium mt-1">Last 30 Days Performance</p>
                    </div>
                    <div className="flex gap-2">
                        {['Day', 'Week', 'Month'].map((period) => (
                            <button
                                key={period}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${period === 'Month'
                                    ? 'bg-white text-black'
                                    : 'bg-[#111] text-[#666] hover:text-white'
                                    }`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
                <RevenueChart />
            </StudioCard>

            {/* Recent Transactions */}
            <StudioCard delay={0.5} noPadding>
                <div className="p-6 border-b border-white/[0.05] bg-[#0A0A0A]">
                    <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
                    <p className="text-xs text-[#666] mt-1">Latest ticket sales and payouts</p>
                </div>
                <div className="p-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-xl transition-colors group cursor-pointer border-b border-white/[0.02] last:border-0">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i % 2 === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[#F44A22]/10 text-[#F44A22]'}`}>
                                    {i % 2 === 0 ? <DollarSign className="w-5 h-5" /> : <TicketIcon className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white group-hover:text-[#F44A22] transition-colors">
                                        {i % 2 === 0 ? 'Payout Processed' : 'Ticket Sale - VIP Table'}
                                    </p>
                                    <p className="text-xs text-[#666]">Today, 2:30 PM</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-sm font-bold ${i % 2 === 0 ? 'text-white' : 'text-emerald-400'}`}>
                                    {i % 2 === 0 ? '-₹45,000' : '+₹5,000'}
                                </p>
                                <p className="text-[10px] text-[#444] uppercase font-bold tracking-wider">Completed</p>
                            </div>
                        </div>
                    ))}
                </div>
            </StudioCard>
        </div>
    );
}

function TicketIcon({ className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" />
            <path d="M13 17v2" />
            <path d="M13 11v2" />
        </svg>
    )
}
