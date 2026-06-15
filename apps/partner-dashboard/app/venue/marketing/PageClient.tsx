'use client';

import { useMemo, useState } from 'react';
import { Filter, MessageSquare, Search, Tag, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useToast } from '@/components/ui/Toast';

type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number | null;
  dob: string | null;
  eventName: string;
  entryTime: string | null;
  status: string;
  marketingConsent: {
    allowPlatformMessages: boolean;
    allowDirectContactShare: boolean;
    consentStatement: string | null;
    recordedAt: string | null;
  };
};

type OrderRecord = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  amount: number;
  ticketsCount: number;
  createdAt: string;
};

type RecipientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventName: string;
  tickets: number;
  totalSpend: number;
  lastPurchase: string | null;
  deliveryMode: 'platform_managed';
  directShareAllowed: boolean;
};

function deriveRecipients(customers: CustomerRecord[], orders: OrderRecord[]) {
  const metrics = new Map<
    string,
    { tickets: number; totalSpend: number; lastPurchase: string | null }
  >();

  orders.forEach((order) => {
    const key = `${order.email || ''}-${order.customerName || ''}`.toLowerCase();
    const current = metrics.get(key) || { tickets: 0, totalSpend: 0, lastPurchase: null };
    current.tickets += order.ticketsCount || 0;
    current.totalSpend += order.amount || 0;
    current.lastPurchase =
      !current.lastPurchase ||
      new Date(order.createdAt).getTime() > new Date(current.lastPurchase).getTime()
        ? order.createdAt
        : current.lastPurchase;
    metrics.set(key, current);
  });

  return customers.map((customer) => {
    const key = `${customer.email || ''}-${customer.name || ''}`.toLowerCase();
    const metric = metrics.get(key);
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      eventName: customer.eventName,
      tickets: metric?.tickets || 0,
      totalSpend: metric?.totalSpend || 0,
      lastPurchase: metric?.lastPurchase || customer.entryTime,
      deliveryMode: 'platform_managed',
      directShareAllowed: customer.marketingConsent?.allowDirectContactShare === true,
    } satisfies RecipientRow;
  });
}

function formatSpend(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function VenueMarketingPageClient() {
  const { profile, user } = useDashboardAuth();
  const { success, error } = useToast();
  const venueId = profile?.activeMembership?.partnerId;
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['venue', venueId, 'marketing', 'customers'],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user!.getIdToken();
      const response = await fetch(`/api/partners/venues/crm/online?venueId=${venueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch attendees');
      const payload = await response.json();
      if (!Array.isArray(payload?.customers)) throw new Error('Malformed attendees response');
      return payload.customers as CustomerRecord[];
    },
    staleTime: 60_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['venue', venueId, 'marketing', 'orders'],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user!.getIdToken();
      const response = await fetch(
        `/api/partners/venues/orders?venueId=${venueId}&page=1&limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error('Failed to fetch order history');
      const payload = await response.json();
      if (!Array.isArray(payload?.orders)) throw new Error('Malformed order response');
      return payload.orders as OrderRecord[];
    },
    staleTime: 60_000,
  });

  const recipients = useMemo(
    () => deriveRecipients(customersQuery.data ?? [], ordersQuery.data ?? []),
    [customersQuery.data, ordersQuery.data],
  );

  const loadError =
    (customersQuery.error instanceof Error && customersQuery.error.message) ||
    (ordersQuery.error instanceof Error && ordersQuery.error.message) ||
    null;

  const filteredRecipients = useMemo(
    () =>
      recipients.filter((recipient) =>
        [recipient.name, recipient.email, recipient.phone, recipient.eventName]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [recipients, query],
  );

  const selectedRecipients = recipients.filter((recipient) => selectedIds.includes(recipient.id));

  const toggleRecipient = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleAll = () => {
    const visibleIds = filteredRecipients.map((recipient) => recipient.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };

  const openComposer = () => {
    if (selectedIds.length === 0) {
      error(
        'Select recipients',
        'Choose at least one attendee before opening the campaign composer.',
      );
      return;
    }
    setComposerOpen(true);
  };

  const handleSend = async () => {
    if (!user || !venueId) {
      error(
        'Unavailable',
        'You must be signed in with an active venue membership to queue campaigns.',
      );
      return;
    }

    if (!message.trim()) {
      error('Add a message', 'Write the campaign message before queuing delivery.');
      return;
    }

    try {
      setIsSending(true);
      const token = await user.getIdToken();
      const response = await fetch(`/api/partners/venues/marketing/campaigns?venueId=${venueId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientIds: selectedIds,
          message: message.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to queue campaign');
      }

      success(
        'Campaign queued',
        `Platform-managed delivery was queued for ${selectedIds.length} attendee${selectedIds.length === 1 ? '' : 's'}.`,
      );
      setComposerOpen(false);
      setMessage('');
      setSelectedIds([]);
    } catch (sendError: any) {
      error('Campaign failed', sendError?.message || 'Failed to queue the campaign for delivery.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <VenuePageShell
      title="Marketing"
      subtitle="Queue platform-managed campaigns without exposing attendee phone numbers or email addresses."
      actions={
        <VenueActionButton variant="secondary" onClick={openComposer}>
          Open Campaign Composer
        </VenueActionButton>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <label className="dashboard-searchbar flex-1">
          <Search className="h-4 w-4 text-[var(--v-text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, masked contact, event"
          />
        </label>

        <div className="dashboard-filter-row">
          <button type="button" className="dashboard-filter-chip">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button type="button" className="dashboard-filter-chip">
            <Tag className="h-4 w-4" />
            Tag
          </button>
        </div>
      </div>

      <div className="dashboard-panel p-6">
        {loadError ? (
          <div className="rounded-[18px] border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {loadError}
          </div>
        ) : customersQuery.isLoading || ordersQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-[18px] bg-[var(--v-elevated)]"
              />
            ))}
          </div>
        ) : filteredRecipients.length === 0 ? (
          <div className="dashboard-empty-state">
            <div>
              <h3>No attendees found</h3>
              <p>Venue-wide attendee records will appear here as events are sold and checked in.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dashboard-data-table min-w-[880px]">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="inline-flex h-5 w-5 rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)]"
                    />
                  </th>
                  <th>Name</th>
                  <th>Tickets</th>
                  <th>Total Spend</th>
                  <th>Contact</th>
                  <th>Delivery</th>
                  <th>Last Purchase</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {filteredRecipients.map((recipient) => {
                  const selected = selectedIds.includes(recipient.id);
                  return (
                    <tr key={recipient.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleRecipient(recipient.id)}
                          className={`inline-flex h-5 w-5 rounded-full border ${selected ? 'border-[var(--v-orange)] bg-[var(--v-orange)]' : 'border-[var(--v-border)] bg-[var(--v-elevated)]'}`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)] text-[12px] font-black text-[var(--v-text-primary)]">
                            {recipient.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-[var(--v-text-primary)]">
                            {recipient.name}
                          </span>
                        </div>
                      </td>
                      <td>{recipient.tickets}</td>
                      <td>{formatSpend(recipient.totalSpend)}</td>
                      <td>
                        <div className="space-y-1 text-sm">
                          <div>{recipient.email}</div>
                          <div className="text-[var(--v-text-tertiary)]">{recipient.phone}</div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-2">
                          <span className="dashboard-filter-chip">Platform send</span>
                          {!recipient.directShareAllowed && (
                            <div className="text-[11px] text-[var(--v-text-tertiary)]">
                              Direct export disabled
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {recipient.lastPurchase
                          ? new Date(recipient.lastPurchase).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="venue-utility-button"
                          onClick={openComposer}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {composerOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm"
              onClick={() => setComposerOpen(false)}
              aria-label="Close campaign composer"
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="fixed inset-x-4 top-8 z-[130] mx-auto max-w-5xl rounded-[32px] border border-[var(--v-border)] bg-[#101319] shadow-[0_40px_140px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--v-border)] px-8 py-6">
                <div>
                  <h2 className="text-[34px] font-semibold tracking-[-0.05em] text-white">
                    New SMS Campaign
                  </h2>
                  <p className="mt-2 text-sm text-white/48">
                    Compose a custom blast for the selected venue audience.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="venue-utility-button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-8 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div className="rounded-[24px] border border-[var(--v-border)] bg-[#131722] p-5">
                    <p className="dashboard-stat-kicker">Recipients</p>
                    <p className="mt-3 text-sm text-white/72">
                      This campaign will be queued to THE C1RCLE delivery layer for{' '}
                      {selectedRecipients.length} attendee
                      {selectedRecipients.length === 1 ? '' : 's'}.
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      Contact data stays masked in the dashboard. Direct sharing remains disabled
                      unless venue-specific consent has been recorded.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="dashboard-filter-row">
                      <button
                        type="button"
                        className="dashboard-filter-chip"
                        onClick={() => setMessage((value) => `${value} {{first_name}}`)}
                      >
                        Insert Field
                      </button>
                      <button
                        type="button"
                        className="dashboard-filter-chip"
                        onClick={() => setMessage((value) => `${value} {{event_link}}`)}
                      >
                        Attach Event Link
                      </button>
                    </div>
                    <label className="block rounded-[24px] border border-[var(--v-border)] bg-[#11151f] p-5">
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                        Compose your message
                      </div>
                      <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        rows={6}
                        className="w-full resize-none rounded-[20px] border border-white/8 bg-[#0d1016] px-4 py-4 text-sm text-white outline-none"
                        placeholder="Enter your custom message here..."
                      />
                      <div className="mt-3 text-right text-sm text-white/42">
                        {message.length}/140 Characters
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setComposerOpen(false)}
                      className="dashboard-filter-chip"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      className="venue-cta-primary"
                      disabled={isSending}
                    >
                      {isSending ? 'Queueing...' : 'Queue Campaign'}
                    </button>
                  </div>
                </div>

                <div className="rounded-[32px] bg-[#0d1526] px-6 py-6">
                  <div className="mx-auto max-w-[240px] rounded-[30px] border border-white/8 bg-[#1a1d24] px-4 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                    <div className="mb-4 flex items-center justify-between text-[11px] text-white/48">
                      <span>12:56</span>
                      <span>42302</span>
                    </div>
                    <div className="space-y-3">
                      <div className="max-w-[180px] rounded-[20px] bg-[#2b2d35] px-4 py-3 text-sm text-white/78">
                        {profile?.displayName || 'THE C1RCLE'}:
                      </div>
                      <div className="max-w-[220px] rounded-[24px] bg-black px-4 py-4 text-sm leading-6 text-white/82">
                        {message || 'Enter your message here...'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </VenuePageShell>
  );
}
