'use client';

import { useState } from 'react';
import {
  Plus,
  Link2,
  Settings,
  GripVertical,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { VenueTable, type Column } from '@/components/ui/VenueTable';
import { Button, IconButton } from '@/components/ui/Button';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import {
  useTicketSync,
  tierToEditForm,
  type TicketTier as TicketType,
  type TicketFormValues,
  type TicketEditFormValues,
  type TicketStatus,
} from '@/lib/hooks/useTicketSync';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  on_sale: { label: 'On Sale', color: '#34D399', bg: 'rgba(52,211,153,0.10)' },
  hidden: { label: 'Hidden', color: '#A1A1AA', bg: 'rgba(161,161,170,0.10)' },
  sold_out: { label: 'Sold Out', color: '#F87171', bg: 'rgba(248,113,113,0.10)' },
  scheduled: { label: 'Scheduled', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)' },
};

function formatPrice(price: number | null) {
  if (price === null) return 'FREE';
  return `₹${price.toLocaleString('en-IN')}`;
}

function formatDateDisplay(iso: string | null) {
  if (!iso) return <span style={{ color: 'var(--v-text-tertiary)' }}>No date</span>;
  const d = new Date(iso);
  return (
    <span style={{ color: 'var(--v-text-secondary)' }}>
      {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );
}

const ENTRY_TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'stag', label: 'Stag' },
  { value: 'couple', label: 'Couple' },
  { value: 'female', label: 'Ladies' },
  { value: 'vip', label: 'VIP' },
  { value: 'table', label: 'Table' },
  { value: 'cover', label: 'Cover' },
];

// ─── Date Input ───────────────────────────────────────────────────────────────

const dateInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--v-elevated)',
  border: '1px solid var(--v-border)',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--v-text-primary)',
  outline: 'none',
  colorScheme: 'dark',
};

// ─── Add Ticket Modal ─────────────────────────────────────────────────────────

const EMPTY_FORM: TicketFormValues = {
  name: '',
  price: '',
  quantity: '50',
  openSale: '',
  endSale: '',
  entryType: 'general',
  minPurchaseQuantity: '1',
  maxPurchaseQuantity: '10',
  promoterEnabled: true,
};

function TicketFormModal({
  open,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (v: TicketFormValues) => void;
}) {
  const [form, setForm] = useState<TicketFormValues>(EMPTY_FORM);

  if (!open) return null;

  const set =
    (field: keyof TicketFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggle = (field: keyof TicketFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: 'var(--v-text-secondary)',
    letterSpacing: '0.03em',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--v-elevated)',
    border: '1px solid var(--v-border)',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--v-text-primary)',
    outline: 'none',
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 10,
    background: 'var(--v-elevated)',
    border: '1px solid var(--v-border)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--v-card)',
          border: '1px solid var(--v-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[16px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
              New Ticket Type
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
              Fill in the details for this tier
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--v-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label style={labelStyle}>Ticket Name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. GA — Early Bird"
              value={form.name}
              onChange={set('name')}
              required
              onFocus={(e) => (e.target.style.borderColor = 'var(--c1rcle-orange)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--v-border)')}
            />
          </div>

          {/* Entry Type */}
          <div>
            <label style={labelStyle}>Entry Type</label>
            <select style={inputStyle} value={form.entryType} onChange={set('entryType')}>
              {ENTRY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Price + Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Price (₹)</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="500"
                min="0"
                value={form.price}
                onChange={set('price')}
                onFocus={(e) => (e.target.style.borderColor = 'var(--c1rcle-orange)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--v-border)')}
              />
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="50"
                min="1"
                value={form.quantity}
                onChange={set('quantity')}
                onFocus={(e) => (e.target.style.borderColor = 'var(--c1rcle-orange)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--v-border)')}
              />
            </div>
          </div>

          {/* Min + Max purchase quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Min Per Order</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.minPurchaseQuantity}
                onChange={set('minPurchaseQuantity')}
              />
            </div>
            <div>
              <label style={labelStyle}>Max Per Order</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.maxPurchaseQuantity}
                onChange={set('maxPurchaseQuantity')}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--v-border)' }} />

          {/* Open Sale Date */}
          <div>
            <label style={labelStyle}>Open Sale Date</label>
            <input
              style={dateInputStyle}
              type="date"
              value={form.openSale}
              onChange={set('openSale')}
              onFocus={(e) => (e.target.style.borderColor = 'var(--c1rcle-orange)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--v-border)')}
            />
          </div>

          {/* End Sale Date */}
          <div>
            <label style={labelStyle}>End Sale Date</label>
            <input
              style={dateInputStyle}
              type="date"
              value={form.endSale}
              onChange={set('endSale')}
              onFocus={(e) => (e.target.style.borderColor = 'var(--c1rcle-orange)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--v-border)')}
            />
          </div>

          {/* Promoter enabled */}
          <label style={toggleRowStyle}>
            <span className="text-[13px] font-medium" style={{ color: 'var(--v-text-primary)' }}>
              Promoter enabled
            </span>
            <input
              type="checkbox"
              checked={form.promoterEnabled}
              onChange={toggle('promoterEnabled')}
              style={{ width: 16, height: 16, accentColor: 'var(--c1rcle-orange)' }}
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="ghost" size="sm" type="button" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                Saving…
              </span>
            ) : (
              'Save Ticket'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Edit Ticket Modal ────────────────────────────────────────────────────────

function EditTicketModal({
  tier,
  saving,
  onClose,
  onSave,
}: {
  tier: TicketType | null;
  saving: boolean;
  onClose: () => void;
  onSave: (tierId: string, values: TicketEditFormValues) => void;
}) {
  const [form, setForm] = useState<TicketEditFormValues | null>(null);
  const [openTierId, setOpenTierId] = useState<string | null>(null);

  if (tier && tier.id !== openTierId) {
    setOpenTierId(tier.id);
    setForm(tierToEditForm(tier));
  }

  if (!tier || !form) return null;

  const set =
    (field: keyof TicketEditFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev));

  const toggle = (field: keyof TicketEditFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => (prev ? { ...prev, [field]: e.target.checked } : prev));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(tier.id, form);
  };

  const handleClose = () => {
    setOpenTierId(null);
    setForm(null);
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: 'var(--v-text-secondary)',
    letterSpacing: '0.03em',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--v-elevated)',
    border: '1px solid var(--v-border)',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--v-text-primary)',
    outline: 'none',
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 10,
    background: 'var(--v-elevated)',
    border: '1px solid var(--v-border)',
  };

  const TOGGLES: { field: keyof TicketEditFormValues; label: string }[] = [
    { field: 'promoterEnabled', label: 'Promoter enabled' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--v-card)',
          border: '1px solid var(--v-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[16px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
              Edit Ticket Type
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
              Update the details for this tier
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--v-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label style={labelStyle}>Ticket Name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. GA — Early Bird"
              value={form.name}
              onChange={set('name')}
              required
            />
          </div>

          {/* Entry Type */}
          <div>
            <label style={labelStyle}>Entry Type</label>
            <select style={inputStyle} value={form.entryType} onChange={set('entryType')}>
              {ENTRY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Price + Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Price (₹)</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                value={form.price}
                onChange={set('price')}
              />
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.quantity}
                onChange={set('quantity')}
              />
            </div>
          </div>

          {/* Min + Max purchase quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Min Per Order</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.minPurchaseQuantity}
                onChange={set('minPurchaseQuantity')}
              />
            </div>
            <div>
              <label style={labelStyle}>Max Per Order</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={form.maxPurchaseQuantity}
                onChange={set('maxPurchaseQuantity')}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--v-border)' }} />

          {/* Open Sale Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Open Sale Date</label>
              <input
                style={dateInputStyle}
                type="date"
                value={form.openSale}
                onChange={set('openSale')}
              />
            </div>
            <div>
              <label style={labelStyle}>End Sale Date</label>
              <input
                style={dateInputStyle}
                type="date"
                value={form.endSale}
                onChange={set('endSale')}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--v-border)' }} />

          {/* Toggles */}
          <div className="flex flex-col gap-2">
            {TOGGLES.map(({ field, label }) => (
              <label key={field} style={toggleRowStyle}>
                <span
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {label}
                </span>
                <input
                  type="checkbox"
                  checked={form[field] as boolean}
                  onChange={toggle(field)}
                  style={{ width: 16, height: 16, accentColor: 'var(--c1rcle-orange)' }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="ghost" size="sm" type="button" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                Saving…
              </span>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketTypesClient({ eventId }: { eventId: string }) {
  const { profile } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId ?? '';

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<TicketType | null>(null);

  // ── All hooks must be called before any early returns (Rules of Hooks) ──
  const {
    tiers: tickets,
    isLoading,
    isError,
    errorMessage,
    addTier,
    editTier,
    deleteTier,
    addMutationPending,
    editMutationPending,
    deleteMutationPending,
    deletingId,
  } = useTicketSync(eventId, venueId);

  // ── Missing eventId guard (after all hooks) ─────────────────────────────
  if (!eventId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[15px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
          No event selected
        </p>
        <p className="text-[13px]" style={{ color: 'var(--v-text-tertiary)' }}>
          Open an event from the Events list to manage its ticket types.
        </p>
      </div>
    );
  }

  // Build columns here so they close over state setters
  const columns: Column<TicketType>[] = [
    {
      key: 'drag',
      header: '',
      width: 'w-8',
      render: () => (
        <GripVertical
          size={14}
          style={{ color: 'var(--v-text-tertiary)' }}
          className="cursor-grab"
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <span className="text-[14px] font-medium" style={{ color: 'var(--v-text-primary)' }}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.scheduled;
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (row) => (
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: 'var(--v-text-primary)' }}
        >
          {formatPrice(row.price)}
        </span>
      ),
    },
    {
      key: 'sold',
      header: 'Sold',
      sortable: true,
      render: (row) => {
        const isFull = row.sold >= row.capacity;
        return (
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: isFull ? '#F87171' : 'var(--v-text-primary)' }}
          >
            {row.sold} / {row.capacity}
          </span>
        );
      },
    },
    {
      key: 'openSale',
      header: 'Open Sale',
      render: (row) => <span className="text-[13px]">{formatDateDisplay(row.openSale)}</span>,
    },
    {
      key: 'endSale',
      header: 'End Sale',
      render: (row) => <span className="text-[13px]">{formatDateDisplay(row.endSale)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-40',
      render: (row) => {
        const confirming = deleteConfirmId === row.id;
        const deleting = deleteMutationPending && deletingId === row.id;

        if (confirming) {
          return (
            <div className="flex items-center gap-1.5 justify-end">
              <span
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: '#F87171' }}
              >
                <AlertTriangle size={11} />
                Delete?
              </span>
              <button
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}
                onClick={() => {
                  deleteTier(row.id);
                  setDeleteConfirmId(null);
                }}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={11} className="animate-spin" /> : 'Yes'}
              </button>
              <button
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                style={{ background: 'var(--v-elevated)', color: 'var(--v-text-secondary)' }}
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
              >
                No
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              icon={<Link2 size={14} />}
              aria-label="Copy ticket link"
              variant="ghost"
              size="sm"
              title="Copy link"
              onClick={() => navigator.clipboard.writeText(`/tickets/${row.id}`)}
            />
            <IconButton
              icon={<Settings size={14} />}
              aria-label="Edit ticket type"
              variant="ghost"
              size="sm"
              title="Edit"
              onClick={() => setEditingTier(row)}
            />
            <IconButton
              icon={<Trash2 size={14} />}
              aria-label="Delete ticket type"
              variant="ghost"
              size="sm"
              title="Delete"
              className="hover:text-red-400 hover:bg-red-500/10"
              onClick={() => setDeleteConfirmId(row.id)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-[22px] font-bold tracking-tight"
            style={{ color: 'var(--v-text-primary)' }}
          >
            Ticket Types
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
            {isLoading
              ? 'Loading…'
              : `${tickets.length} ticket tier${tickets.length !== 1 ? 's' : ''} for this event`}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={15} />}
          iconPosition="left"
          onClick={() => setModalOpen(true)}
        >
          Add Ticket Type
        </Button>
      </div>

      {isError && (
        <div
          className="mb-4 p-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
          style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: '#F87171',
          }}
        >
          <AlertTriangle size={14} />
          {errorMessage || 'Failed to load ticket tiers. Please refresh and try again.'}
        </div>
      )}

      {/* Table */}
      <VenueTable
        columns={columns}
        rows={tickets}
        keyExtractor={(row) => row.id}
        emptyState={
          isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2
                size={18}
                className="animate-spin"
                style={{ color: 'var(--v-text-tertiary)' }}
              />
              <span className="text-[13px]" style={{ color: 'var(--v-text-tertiary)' }}>
                Loading ticket tiers…
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-[14px] font-medium" style={{ color: 'var(--v-text-tertiary)' }}>
                No ticket types yet
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setModalOpen(true)}
              >
                Add your first ticket type
              </Button>
            </div>
          )
        }
      />

      {/* Modal */}
      <TicketFormModal
        open={modalOpen}
        saving={addMutationPending}
        onClose={() => setModalOpen(false)}
        onSave={async (form) => {
          await addTier(form);
          setModalOpen(false);
        }}
      />

      {/* Edit Modal */}
      <EditTicketModal
        tier={editingTier}
        saving={editMutationPending}
        onClose={() => setEditingTier(null)}
        onSave={async (tierId, form) => {
          await editTier(tierId, form);
          setEditingTier(null);
        }}
      />
    </div>
  );
}
