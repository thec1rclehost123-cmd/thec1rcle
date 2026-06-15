'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, User, Users, CalendarDays, Filter } from 'lucide-react';

export function PromoterGuestsPageClient() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['promoter', 'guests'],
    queryFn: async () => {
      const res = await fetch(`/api/partners/promoters/guests`);
      if (!res.ok) throw new Error('Failed to fetch globals guests');
      return res.json();
    },
  });

  const filteredGuests =
    data?.guests?.filter(
      (g: any) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.event.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <header className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-display-sm text-text-primary tracking-tight font-bold">
            Global Guest List
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-medium">
            Manage all your complementary guests across active and past events.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-surface-tertiary hover:bg-surface-hover text-text-primary px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-border-subtle">
            <Download className="h-4 w-4" />
            Export All
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-6 w-full animate-pulse mt-4">
          <div className="h-24 w-full bg-surface-elevated rounded-2xl border border-border-subtle"></div>
          <div className="h-96 w-full bg-surface-elevated rounded-2xl border border-border-subtle"></div>
        </div>
      ) : error || !data ? (
        <div className="w-full flex justify-center py-20 p-8 border border-red-500/20 rounded-2xl bg-red-500/5 mt-4">
          <div className="text-center text-red-500">
            <p className="font-bold mb-1">Failed to Load</p>
            <p className="text-sm opacity-80">There was an error generating your guest list.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Status overview */}
          <div className="flex items-center gap-4 bg-surface-elevated p-6 border border-border-subtle rounded-2xl">
            <div className="flex-1">
              <h4 className="font-bold text-text-primary text-sm mb-1 uppercase tracking-wider text-text-tertiary">
                Total Allocations
              </h4>
              <div className="flex items-center gap-4 mt-3">
                <div className="h-3 w-full flex bg-surface-tertiary rounded-full overflow-hidden flex-1">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(data.totalUsed / Math.max(data.totalAllowance, 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="whitespace-nowrap text-sm font-bold font-mono text-text-primary">
                  {data.totalUsed}{' '}
                  <span className="text-text-tertiary">/ {data.totalAllowance} SPOTS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated rounded-2xl border border-border-subtle overflow-hidden flex flex-col mt-2">
            <div className="p-4 border-b border-border-subtle bg-surface-base/50 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by name or event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-tertiary border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium placeholder:text-text-muted/70"
                />
              </div>
              <button className="flex items-center justify-center gap-2 bg-surface-tertiary hover:bg-surface-hover text-text-secondary px-4 py-2 rounded-lg font-semibold transition-colors text-sm border border-border-subtle">
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-base/30">
                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                      Guest Details
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                      Added Date
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredGuests.map((guest: any) => (
                    <tr
                      key={guest.id}
                      className="hover:bg-surface-hover/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-surface-tertiary flex items-center justify-center shrink-0">
                            <User className="h-5 w-5 text-text-secondary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-text-primary tracking-tight">
                              {guest.name}
                            </span>
                            <span className="text-xs text-text-tertiary font-medium mt-0.5 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {guest.tickets} ticket{guest.tickets > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-text-secondary items-center gap-2 flex">
                          <CalendarDays className="h-4 w-4 text-text-muted" />
                          {guest.event}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                        {new Date(guest.dateAdded).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            guest.status === 'attending'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : guest.status === 'checked_in'
                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}
                        >
                          {guest.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-sm text-text-tertiary hover:text-emerald-500 font-medium transition-colors opacity-0 group-hover:opacity-100 border border-border-subtle px-3 py-1 rounded-md bg-surface-base">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredGuests.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-text-muted">
                        <Users className="h-10 w-10 mx-auto text-text-tertiary mb-3 opacity-50" />
                        <p className="font-medium text-text-secondary">No guests found</p>
                        <p className="text-sm mt-1">Try adjusting your search criteria</p>
                      </td>
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
