"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CalendarX2 } from "lucide-react";
import { PromoterAssignmentCard } from "./PromoterAssignmentCard";

export function PromoterAssignmentsPageClient() {
    const [statusFilter, setStatusFilter] = useState("active");
    const [searchQuery, setSearchQuery] = useState("");

    const { data, isLoading, error, refetch } = useQuery({
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
                <h1 className="text-display-sm text-text-primary tracking-tight font-bold">
                    My Events
                </h1>
                <p className="text-text-secondary text-sm mt-1 font-medium">
                    Your active performance and upcoming assignments.
                </p>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface-base p-4 rounded-xl border border-border-subtle sticky top-0 z-10 backdrop-blur-md bg-opacity-80">
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-2 sm:pb-0">
                    <button
                        onClick={() => setStatusFilter("active")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                            statusFilter === "active" 
                            ? "bg-surface-elevated border border-border-subtle shadow-sm text-text-primary" 
                            : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                        }`}
                    >
                        Active & Upcoming
                    </button>
                    <button
                        onClick={() => setStatusFilter("completed")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                            statusFilter === "completed" 
                            ? "bg-surface-elevated border border-border-subtle shadow-sm text-text-primary" 
                            : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                        }`}
                    >
                        Past Events
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-surface-tertiary border border-border-subtle rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium placeholder:text-text-muted/70"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {isLoading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                             <div key={i} className="w-full h-64 md:h-52 bg-surface-elevated rounded-2xl border border-border-subtle animate-pulse relative overflow-hidden flex flex-col md:flex-row">
                                  <div className="w-full md:w-1/3 h-full bg-surface-tertiary/50"></div>
                                  <div className="flex-1 p-6 flex flex-col gap-4">
                                      <div className="h-6 w-3/4 bg-surface-tertiary rounded-md"></div>
                                      <div className="h-4 w-1/2 bg-surface-tertiary rounded-md mt-2"></div>
                                      <div className="mt-auto pt-6 border-t border-border-subtle flex items-center justify-between">
                                          <div className="h-8 w-32 bg-surface-tertiary rounded-lg"></div>
                                          <div className="h-10 w-24 bg-surface-tertiary rounded-xl"></div>
                                      </div>
                                  </div>
                             </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="w-full p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                        <p className="font-bold">Failed to Load</p>
                        <p className="text-sm opacity-80">There was an error fetching your event assignments.</p>
                        <button
                            onClick={() => refetch()}
                            className="px-5 py-2 rounded-xl bg-surface-elevated border border-border-subtle text-text-primary text-sm font-semibold hover:bg-surface-hover transition-colors mt-1"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredAssignments.length > 0 ? (
                    filteredAssignments.map((assignment: any) => (
                        <PromoterAssignmentCard key={assignment.id} assignment={assignment} />
                    ))
                ) : (
                    <div className="w-full flex-col h-64 flex items-center justify-center text-center bg-surface-elevated border border-border-subtle rounded-2xl p-8">
                        <div className="h-16 w-16 bg-surface-tertiary rounded-full flex items-center justify-center mb-4 text-text-muted">
                            <CalendarX2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-text-primary mb-2">No events found</h3>
                        <p className="text-text-secondary">
                            {searchQuery ? `No results match "${searchQuery}"` : "You haven't been assigned to any events in this status yet."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
