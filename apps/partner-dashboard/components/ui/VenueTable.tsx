"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { DashCard } from "./DashCard";

export interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    width?: string;
    render: (row: T, idx: number) => React.ReactNode;
}

interface VenueTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    keyExtractor: (row: T) => string;
    emptyState?: React.ReactNode;
    loading?: boolean;
    className?: string;
    stickyHeader?: boolean;
}

type SortDir = "asc" | "desc" | null;

export function VenueTable<T>({
    columns,
    rows,
    keyExtractor,
    emptyState,
    loading = false,
    className = "",
    stickyHeader = false,
}: VenueTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>(null);

    const handleSort = (key: string) => {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("asc");
        } else if (sortDir === "asc") {
            setSortDir("desc");
        } else {
            setSortKey(null);
            setSortDir(null);
        }
    };

    return (
        <DashCard padding="none" className={`overflow-hidden ${className}`}>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className={`border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-5 py-3 text-left dash-label text-[var(--text-tertiary)] whitespace-nowrap select-none ${col.width || ""} ${col.sortable ? "cursor-pointer hover:text-[var(--text-secondary)]" : ""}`}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <span className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && sortKey === col.key && (
                                            sortDir === "asc"
                                                ? <ArrowUp className="h-3 w-3" />
                                                : <ArrowDown className="h-3 w-3" />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-[var(--border-subtle)]">
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-5 py-3">
                                            <div className="h-4 rounded-[var(--r-sm)] bg-[var(--bg-fill)] animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length}>
                                    <div className="py-16 px-8 text-center">
                                        {emptyState || (
                                            <p className="dash-body-sm text-[var(--text-tertiary)]">No data</p>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr
                                    key={keyExtractor(row)}
                                    className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-fill)] transition-colors duration-[var(--t-fast)] group`}
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-5 py-3 dash-body-sm text-[var(--text-primary)]">
                                            {col.render(row, idx)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </DashCard>
    );
}
