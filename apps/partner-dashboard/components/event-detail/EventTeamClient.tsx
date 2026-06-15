'use client';

import { useState } from 'react';
import {
  X,
  Search,
  Mail,
  Phone,
  Trash2,
  Edit2,
  UserPlus,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { VenueTable, type Column } from '@/components/ui/VenueTable';
import { Avatar } from '@/components/ui/Avatar';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchMode = 'email' | 'phone';
type ModalStep = 'search' | 'add-manual';

interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
  role: string;
  lastLogin: string; // relative string for mock
}

interface HostSalesRow {
  id: string;
  name: string;
  clicks: number;
  ticketsSold: number;
  conversionRate: number; // 0–100
  revenueGenerated: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Avante Price', role: 'Owner', lastLogin: 'Just now' },
  { id: '2', name: 'Eli Taylor-Lemire', role: 'Manager', lastLogin: '1 year ago' },
  { id: '3', name: 'Owen Colwell', role: 'Staff', lastLogin: '4 months ago' },
  { id: '4', name: 'Teddy Eisenstein', role: 'Promoter', lastLogin: '3 days ago' },
];

const MOCK_HOST_SALES: HostSalesRow[] = [
  {
    id: '1',
    name: 'Teddy Eisenstein',
    clicks: 0,
    ticketsSold: 0,
    conversionRate: 0,
    revenueGenerated: 0,
  },
  {
    id: '2',
    name: 'Owen Colwell',
    clicks: 18,
    ticketsSold: 4,
    conversionRate: 22.2,
    revenueGenerated: 3200,
  },
  {
    id: '3',
    name: 'Eli Taylor-Lemire',
    clicks: 34,
    ticketsSold: 9,
    conversionRate: 26.5,
    revenueGenerated: 7200,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  if (n === 0) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--v-elevated)',
  border: '1px solid var(--v-border)',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 13,
  color: 'var(--v-text-primary)',
  outline: 'none',
  colorScheme: 'dark',
};

// ─── Add Team Member Modal ────────────────────────────────────────────────────

interface ManualForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
}

const EMPTY_MANUAL: ManualForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  countryCode: '+91',
};

function AddTeamMemberModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (member: { name: string; role: string }) => void;
}) {
  const [step, setStep] = useState<ModalStep>('search');
  const [mode, setMode] = useState<SearchMode>('email');
  const [searchQuery, setSearchQuery] = useState('');
  const [manual, setManual] = useState<ManualForm>(EMPTY_MANUAL);

  if (!open) return null;

  function handleClose() {
    setStep('search');
    setSearchQuery('');
    setManual(EMPTY_MANUAL);
    onClose();
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.firstName.trim()) return;
    onAdd({
      name: `${manual.firstName.trim()} ${manual.lastName.trim()}`.trim(),
      role: 'Staff',
    });
    handleClose();
  }

  const setM =
    (field: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setManual((prev) => ({ ...prev, [field]: e.target.value }));

  const focusOrange = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'var(--c1rcle-orange)');
  const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'var(--v-border)');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl"
        style={{
          background: 'var(--v-card)',
          border: '1px solid var(--v-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between p-6"
          style={{ borderBottom: '1px solid var(--v-border)' }}
        >
          <div className="flex items-center gap-3">
            {step === 'add-manual' && (
              <button
                onClick={() => setStep('search')}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--v-text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div>
              <p className="text-[16px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
                {step === 'search' ? 'Add a Team Member' : 'Add Member Details'}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
                {step === 'search'
                  ? 'Search by email or phone number'
                  : 'Fill in the details for this person'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--v-text-tertiary)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--v-elevated)';
              (e.currentTarget as HTMLElement).style.color = 'var(--v-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--v-text-tertiary)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Step 1: Search ── */}
        {step === 'search' && (
          <div className="p-6 flex flex-col gap-4">
            {/* Email / Phone toggle */}
            <div
              className="flex p-1 rounded-xl gap-0.5"
              style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
            >
              {(['email', 'phone'] as SearchMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all"
                  style={
                    mode === m
                      ? {
                          background: 'var(--v-card)',
                          color: 'var(--v-text-primary)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }
                      : { color: 'var(--v-text-tertiary)' }
                  }
                >
                  {m === 'email' ? <Mail size={13} /> : <Phone size={13} />}
                  {m === 'email' ? 'Email' : 'Phone'}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--v-text-tertiary)' }}
              />
              <input
                type={mode === 'email' ? 'email' : 'tel'}
                placeholder={
                  mode === 'email' ? 'Search by email address…' : 'Search by phone number…'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 38 }}
                onFocus={focusOrange}
                onBlur={blurBorder}
              />
            </div>

            <Button variant="primary" size="sm" fullWidth>
              Search
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--v-border)' }} />
              <span
                className="text-[11px] font-semibold"
                style={{ color: 'var(--v-text-tertiary)' }}
              >
                or
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--v-border)' }} />
            </div>

            <Button
              variant="secondary"
              size="sm"
              fullWidth
              icon={<UserPlus size={14} />}
              onClick={() => setStep('add-manual')}
            >
              Add a Non-System User
            </Button>
          </div>
        )}

        {/* ── Step 2: Manual Entry ── */}
        {step === 'add-manual' && (
          <form onSubmit={handleContinue}>
            <div className="p-6 flex flex-col gap-3">
              {/* First + Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-[11px] font-semibold mb-1.5"
                    style={{ color: 'var(--v-text-secondary)' }}
                  >
                    First Name *
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="First name"
                    value={manual.firstName}
                    onChange={setM('firstName')}
                    required
                    onFocus={focusOrange}
                    onBlur={blurBorder}
                  />
                </div>
                <div>
                  <label
                    className="block text-[11px] font-semibold mb-1.5"
                    style={{ color: 'var(--v-text-secondary)' }}
                  >
                    Last Name
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Last name"
                    value={manual.lastName}
                    onChange={setM('lastName')}
                    onFocus={focusOrange}
                    onBlur={blurBorder}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  className="block text-[11px] font-semibold mb-1.5"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  Email
                </label>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="email@example.com"
                  value={manual.email}
                  onChange={setM('email')}
                  onFocus={focusOrange}
                  onBlur={blurBorder}
                />
              </div>

              {/* Phone with country code */}
              <div>
                <label
                  className="block text-[11px] font-semibold mb-1.5"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <select
                    value={manual.countryCode}
                    onChange={setM('countryCode')}
                    style={{
                      ...inputStyle,
                      width: 'auto',
                      minWidth: 80,
                      paddingRight: 8,
                      cursor: 'pointer',
                    }}
                    onFocus={focusOrange}
                    onBlur={blurBorder}
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+65">🇸🇬 +65</option>
                  </select>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="tel"
                    placeholder="Phone number"
                    value={manual.phone}
                    onChange={setM('phone')}
                    onFocus={focusOrange}
                    onBlur={blurBorder}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 pb-6">
              <Button variant="ghost" size="sm" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Continue
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EventTeamClient({ eventId }: { eventId: string }) {
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function handleAdd(member: { name: string; role: string }) {
    setTeam((prev) => [
      ...prev,
      { id: String(Date.now()), name: member.name, role: member.role, lastLogin: 'Never' },
    ]);
  }

  function handleDelete(id: string) {
    setTeam((prev) => prev.filter((m) => m.id !== id));
    setDeleteConfirmId(null);
  }

  // ── Team Table Columns ──
  const teamColumns: Column<TeamMember>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} src={row.avatarUrl} size="sm" />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
              {row.name}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--v-text-tertiary)' }}>
              {row.role}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (row) => (
        <span className="text-[13px]" style={{ color: 'var(--v-text-secondary)' }}>
          {row.lastLogin}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-36',
      render: (row) => {
        const isOwner = row.role === 'Owner';
        const confirming = deleteConfirmId === row.id;

        if (confirming) {
          return (
            <div className="flex items-center gap-1.5 justify-end">
              <span
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: '#F87171' }}
              >
                <AlertTriangle size={11} /> Remove?
              </span>
              <button
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}
                onClick={() => handleDelete(row.id)}
              >
                Yes
              </button>
              <button
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: 'var(--v-elevated)', color: 'var(--v-text-secondary)' }}
                onClick={() => setDeleteConfirmId(null)}
              >
                No
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              icon={<Edit2 size={14} />}
              aria-label="Edit member"
              variant="ghost"
              size="sm"
              title="Edit role"
            />
            {!isOwner && (
              <IconButton
                icon={<Trash2 size={14} />}
                aria-label="Remove member"
                variant="ghost"
                size="sm"
                title="Remove from event"
                className="hover:text-red-400 hover:bg-red-500/10"
                onClick={() => setDeleteConfirmId(row.id)}
              />
            )}
          </div>
        );
      },
    },
  ];

  // ── Host Sales Columns ──
  const salesColumns: Column<HostSalesRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            {row.name}
          </span>
        </div>
      ),
    },
    {
      key: 'clicks',
      header: 'Clicks',
      sortable: true,
      render: (row) => (
        <span className="text-[13px] tabular-nums" style={{ color: 'var(--v-text-primary)' }}>
          {row.clicks}
        </span>
      ),
    },
    {
      key: 'ticketsSold',
      header: 'Tickets Sold',
      sortable: true,
      render: (row) => (
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: 'var(--v-text-primary)' }}
        >
          {row.ticketsSold}
        </span>
      ),
    },
    {
      key: 'conversionRate',
      header: 'Conversion Rate',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div
            className="w-20 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--v-elevated)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(row.conversionRate, 100)}%`,
                background: row.conversionRate > 0 ? 'var(--c1rcle-orange)' : 'transparent',
              }}
            />
          </div>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--v-text-secondary)' }}>
            {row.conversionRate.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue Generated',
      sortable: true,
      render: (row) => (
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: 'var(--v-text-primary)' }}
        >
          {formatINR(row.revenueGenerated)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-10">
      {/* ── Team Section ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              className="text-[22px] font-bold tracking-tight"
              style={{ color: 'var(--v-text-primary)' }}
            >
              Team
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
              {team.length} member{team.length !== 1 ? 's' : ''} on this event
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={14} />}
            iconPosition="left"
            onClick={() => setModalOpen(true)}
          >
            Add Team Member
          </Button>
        </div>

        <VenueTable
          columns={teamColumns}
          rows={team}
          keyExtractor={(r) => r.id}
          emptyState={
            <p className="py-8 text-center text-[13px]" style={{ color: 'var(--v-text-tertiary)' }}>
              No team members yet.
            </p>
          }
        />
      </section>

      {/* ── Host Sales Section ── */}
      <section>
        <div className="mb-5">
          <h2
            className="text-[22px] font-bold tracking-tight"
            style={{ color: 'var(--v-text-primary)' }}
          >
            Host Sales
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
            Ticket sales performance per team member
          </p>
        </div>

        <VenueTable columns={salesColumns} rows={MOCK_HOST_SALES} keyExtractor={(r) => r.id} />
      </section>

      {/* ── Modal ── */}
      <AddTeamMemberModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAdd} />
    </div>
  );
}
