"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CalendarX2 } from "lucide-react";
import { PromoterAssignmentCard } from "./PromoterAssignmentCard";

export function PromoterAssignmentsPageClient() {
    const [statusFilter, setStatusFilter] = useState("active");
    const [searchQuery, setSearchQuery] = useState("");

    const { data, isLoading, error } = useQuery({
        queryKey: ["promoter", "events", statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/partner/promoter/events?status=${statusFilter}`);
            if (!res.ok) throw new Error("Failed to fetch assignments");
            return res.json();
        },
    });

    const assignments = data?.assignments || [];

    // Local Search Filter
    const filteredAssignments = assignments.filter((a: any) => 
        a.event?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.event?.venue?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <header className="mb-2">
                <h1 className="text-display-sm text-[var(--text-primary)] tracking-tight font-bold">
                    My Events
                </h1>
                <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium">
                    Your active performance and upcoming assignments.
                </p>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[var(--bg-base)] p-4 rounded-xl border border-[var(--border-subtle)] sticky top-0 z-10 backdrop-blur-md bg-opacity-80">
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-2 sm:pb-0">
                    <button
                        onClick={() => setStatusFilter("active")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                            statusFilter === "active" 
                            ? "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-sm text-[var(--text-primary)]" 
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)]"
                        }`}
                    >
                        Active & Upcoming
                    </button>
                    <button
                        onClick={() => setStatusFilter("completed")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                            statusFilter === "completed" 
                            ? "bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-sm text-[var(--text-primary)]" 
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)]"
                        }`}
                    >
                        Past Events
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium placeholder:text-[var(--text-tertiary)]/70"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {isLoading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                             <div key={i} className="w-full h-64 md:h-52 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)] animate-pulse relative overflow-hidden flex flex-col md:flex-row">
                                  <div className="w-full md:w-1/3 h-full bg-[var(--bg-secondary)]/50"></div>
                                  <div className="flex-1 p-6 flex flex-col gap-4">
                                      <div className="h-6 w-3/4 bg-[var(--bg-secondary)] rounded-md"></div>
                                      <div className="h-4 w-1/2 bg-[var(--bg-secondary)] rounded-md mt-2"></div>
                                      <div className="mt-auto pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
                                          <div className="h-8 w-32 bg-[var(--bg-secondary)] rounded-lg"></div>
                                          <div className="h-10 w-24 bg-[var(--bg-secondary)] rounded-xl"></div>
                                      </div>
                                  </div>
                             </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="w-full p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex flex-col items-center justify-center text-center">
                        <p className="font-bold mb-1">Failed to Load</p>
                        <p className="text-sm opacity-80">There was an error fetching your event assignments.</p>
                    </div>
                ) : filteredAssignments.length > 0 ? (
                    filteredAssignments.map((assignment: any) => (
                        <PromoterAssignmentCard key={assignment.id} assignment={assignment} />
                    ))
                ) : (
                    <div className="w-full flex-col h-64 flex items-center justify-center text-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-8">
                        <div className="h-16 w-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 text-[var(--text-tertiary)]">
                            <CalendarX2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] mb-2">No events found</h3>
                        <p className="text-[var(--text-secondary)]">
                            {searchQuery ? `No results match "${searchQuery}"` : "You haven't been assigned to any events in this status yet."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
