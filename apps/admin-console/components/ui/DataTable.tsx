'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface DataTableProps {
  columns: any[];
  data: any[];
  onRowClick?: (row: any) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
}

export function DataTable({
  columns,
  data,
  onRowClick,
  searchPlaceholder = 'Search records...',
  actions,
  loading = false,
  searchQuery: externalSearchQuery,
  onSearchChange,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
}: DataTableProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = onSearchChange ?? setInternalSearchQuery;
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...(data ?? [])].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
    return 0;
  });

  const filteredData = sortedData.filter((row) =>
    Object.values(row).some((val) => String(val).toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      {/* Table Header / Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-iris/50 focus:border-iris/50 transition-all placeholder:text-zinc-600"
          />
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Main Data Grid */}
      <div className="bg-obsidian-surface border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                {columns.map((col) => (
                  <th
                    key={col.key || col.accessorKey || col.id || col.header}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 ${col.sortable ? 'cursor-pointer hover:text-zinc-300' : ''} transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {col.sortable &&
                        sortConfig?.key === col.key &&
                        (sortConfig?.direction === 'ascending' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        ))}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    onClick={() => onRowClick?.(row)}
                    className="group hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key || col.accessorKey || col.id || col.header}
                        className="px-6 py-4 text-sm font-medium text-zinc-300 group-hover:text-white transition-colors"
                      >
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-24 text-center">
                    <EmptyState
                      icon={emptyIcon}
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                    />
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
