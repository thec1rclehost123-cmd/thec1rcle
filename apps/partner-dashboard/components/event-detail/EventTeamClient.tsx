'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  TrendingUp,
  Users,
  Coins,
  CheckCircle,
  XCircle,
  Plus,
  Columns,
  ExternalLink,
} from 'lucide-react';
import { VenueTable, type Column } from '@/components/ui/VenueTable';
import { Avatar } from '@/components/ui/Avatar';
import { Button, IconButton } from '@/components/ui/Button';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchMode = 'email' | 'phone';
type ModalStep = 'search' | 'add-manual';

interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
  role: string;
  lastLogin: string;
  email?: string;
}

interface PromoterRow {
  id: string;
  promoterId: string;
  name: string;
  email: string;
  phone?: string;
  instagram?: string;
  avatarUrl?: string;
  clicks: number;
  ticketsSold: number;
  conversionRate: number; // 0–100
  revenueGenerated: number;
  rsvpCount: number;
  code: string;
  guests: any[];
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  if (n === 0) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

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
  onAdd: (manual: ManualForm) => void;
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
    onAdd(manual);
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

            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => {
                setManual((prev) => ({
                  ...prev,
                  email: mode === 'email' ? searchQuery : '',
                  phone: mode === 'phone' ? searchQuery : '',
                }));
                setStep('add-manual');
              }}
            >
              Search
            </Button>

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
  const { profile, user } = useDashboardAuth();
  const venueId = profile?.activeMembership?.partnerId ?? '';

  // Staff States
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Promoter states
  const [promotersData, setPromotersData] = useState<{
    promoters: any[];
    promoterSettings: any;
    summary: any;
  }>({ promoters: [], promoterSettings: { allowedPromoterIds: [] }, summary: {} });
  const [connections, setConnections] = useState<any[]>([]);
  const [promoterLinks, setPromoterLinks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedPromoters, setSelectedPromoters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Drawer active state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [addPromoterOpen, setAddPromoterOpen] = useState(false);
  const [removingPromoterId, setRemovingPromoterId] = useState<string | null>(null);

  const [detailPromoterId, setDetailPromoterId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await user?.getIdToken();
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...init, headers });
    },
    [user],
  );

  const loadAllData = useCallback(async () => {
    if (!venueId || !user) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Venue Staff
      const staffRes = await authedFetch(`/api/partners/venues/staff`);
      let staffList: TeamMember[] = [];
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        staffList = (staffData.staff || []).map((s: any) => ({
          id: s.id,
          name: s.name || s.email || 'Staff Member',
          role: s.role || 'Staff',
          lastLogin: s.isActive ? 'Active' : 'Deactivated',
          email: s.email,
        }));
      }
      console.log('Staff', staffList);
      // 2. Fetch Event Promoters settings and assignments
      const promRes = await authedFetch(`/api/partners/venues/events/${eventId}/promoters`);
      let pData = { promoters: [], promoterSettings: { allowedPromoterIds: [] }, summary: {} };
      if (promRes.ok) {
        pData = await promRes.json();
      }
      console.log('pdata', pData);

      // 3. Fetch Promoter Connections (both active and approved)
      const [connActiveRes, connApprovedRes] = await Promise.all([
        authedFetch(
          `/api/promoters/connections?entityId=${venueId}&entityType=venue&status=active`,
        ),
        authedFetch(
          `/api/promoters/connections?entityId=${venueId}&entityType=venue&status=approved`,
        ),
      ]);
      let activeConns = [];
      let approvedConns = [];
      if (connActiveRes.ok) {
        const d = await connActiveRes.json();
        activeConns = d.connections || [];
      }
      if (connApprovedRes.ok) {
        const d = await connApprovedRes.json();
        approvedConns = d.connections || [];
      }
      // Merge unique connections by promoterId
      const mergedConnsMap = new Map<string, any>();
      [...activeConns, ...approvedConns].forEach((c: any) => {
        if (c.promoterId) mergedConnsMap.set(c.promoterId, c);
      });
      const allConns = Array.from(mergedConnsMap.values());
      console.log('allConns', allConns);
      // 4. Fetch Event Promoter Links
      const linksRes = await authedFetch(`/api/promoter-links?eventId=${eventId}`);
      let linksList = [];
      if (linksRes.ok) {
        linksList = await linksRes.json();
      }
      console.log('linksList', linksList);
      // 5. Fetch Venue Orders to calculate guest counts
      const ordersRes = await authedFetch(`/api/partners/venues/orders?limit=500`);
      let ordersList = [];
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        ordersList = (oData.orders || []).filter((o: any) => o.eventId === eventId);
      }
      console.log('ordersList', ordersList);
      setTeam(staffList);
      setPromotersData(pData);
      setConnections(allConns);
      setPromoterLinks(linksList);
      setOrders(ordersList);
    } catch (err: any) {
      console.error('[EventTeamClient] loadAllData error:', err);
      setError(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [venueId, eventId, authedFetch]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Staff actions ──

  async function handleAddStaff(manual: ManualForm) {
    if (!venueId) return;
    setStaffLoading(true);
    const name = `${manual.firstName} ${manual.lastName}`.trim();
    const email =
      manual.email ||
      `${manual.firstName.toLowerCase()}.${manual.lastName.toLowerCase()}@example.com`;
    try {
      const res = await authedFetch(`/api/partners/venues/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          role: 'Staff',
        }),
      });
      if (!res.ok) throw new Error('Failed to add staff member');
      loadAllData();
    } catch (err: any) {
      console.error('[EventTeamClient] Add staff error:', err);
      alert('Failed to add staff member: ' + err.message);
    } finally {
      setStaffLoading(false);
    }
  }

  async function handleDeleteStaff(id: string) {
    setStaffLoading(true);
    try {
      const res = await authedFetch(`/api/partners/venues/staff`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: id,
          isActive: false,
        }),
      });
      if (!res.ok) throw new Error('Failed to delete staff member');
      loadAllData();
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error('[EventTeamClient] Remove staff error:', err);
      alert('Failed to remove staff member.');
    } finally {
      setStaffLoading(false);
    }
  }

  // ── Promoter actions ──

  async function handleAddPromoter(promoterId: string) {
    const allowedIds = promotersData.promoterSettings?.allowedPromoterIds || [];
    if (allowedIds.includes(promoterId)) return;

    const nextAllowed = [...allowedIds, promoterId];
    try {
      const res = await authedFetch(`/api/partners/venues/events/${eventId}/promoters`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedPromoterIds: nextAllowed,
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to update promoter settings');
      loadAllData();
      setAddPromoterOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add promoter to event.');
    }
  }

  async function handleRemovePromoter(promoterId: string) {
    const allowedIds = promotersData.promoterSettings?.allowedPromoterIds || [];
    const nextAllowed = allowedIds.filter((id: string) => id !== promoterId);
    try {
      const res = await authedFetch(`/api/partners/venues/events/${eventId}/promoters`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedPromoterIds: nextAllowed,
        }),
      });
      if (!res.ok) throw new Error('Failed to update promoter settings');
      loadAllData();
      setRemovingPromoterId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to remove promoter from event.');
    }
  }

  // ── Joined Promoter Roster ──

  const resolvedPromoters = useMemo(() => {
    const promoterIdsSet = new Set<string>();

    const allowedIds = promotersData.promoterSettings?.allowedPromoterIds || [];
    allowedIds.forEach((id: string) => promoterIdsSet.add(id));

    promotersData.promoters?.forEach((p: any) => {
      if (p.promoterId) promoterIdsSet.add(p.promoterId);
    });

    promoterLinks.forEach((l: any) => {
      if (l.promoterId) promoterIdsSet.add(l.promoterId);
    });

    return Array.from(promoterIdsSet).map((pId) => {
      const conn = connections.find((c) => c.promoterId === pId);
      const name = conn?.promoterName || 'Promoter ' + pId.slice(0, 4);
      const email = conn?.promoterEmail || '';

      const link = promoterLinks.find((l) => l.promoterId === pId);
      const code = link?.code || '';

      const promoterOrders = orders.filter(
        (o) => o.promoterCode && code && o.promoterCode.toLowerCase() === code.toLowerCase(),
      );

      const ticketsSold = promoterOrders
        .filter((o) => o.amount > 0)
        .reduce((sum, o) => sum + (o.ticketsCount || 0), 0);

      const rsvpCount = promoterOrders
        .filter((o) => o.amount === 0)
        .reduce((sum, o) => sum + (o.ticketsCount || 0), 0);

      const revenueGenerated = promoterOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

      const clicks = link?.clicks || 0;
      const conversions = link?.conversions || promoterOrders.length;
      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

      return {
        id: pId,
        promoterId: pId,
        name,
        email,
        avatarUrl: conn?.photoURL || undefined,
        code,
        clicks,
        ticketsSold,
        rsvpCount,
        revenueGenerated,
        conversionRate,
        guests: promoterOrders,
        status: allowedIds.includes(pId) ? 'active' : 'inactive',
      };
    });
  }, [promotersData, connections, promoterLinks, orders]);

  const filteredPromoters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return resolvedPromoters;
    return resolvedPromoters.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [resolvedPromoters, searchQuery]);

  const availablePromoters = useMemo(() => {
    const allowedIds = promotersData.promoterSettings?.allowedPromoterIds || [];
    return connections.filter((c) => !allowedIds.includes(c.promoterId));
  }, [connections, promotersData]);

  // Promoter Details Selection
  const detailPromoter = useMemo(() => {
    return resolvedPromoters.find((p) => p.promoterId === detailPromoterId);
  }, [resolvedPromoters, detailPromoterId]);

  // Comparison list
  const comparePromotersList = useMemo(() => {
    return resolvedPromoters.filter((p) => selectedPromoters.has(p.promoterId));
  }, [resolvedPromoters, selectedPromoters]);

  const allSelected =
    filteredPromoters.length > 0 &&
    filteredPromoters.every((p) => selectedPromoters.has(p.promoterId));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedPromoters(new Set());
    } else {
      setSelectedPromoters(new Set(filteredPromoters.map((p) => p.promoterId)));
    }
  }

  function toggleSelectOne(pId: string) {
    setSelectedPromoters((prev) => {
      const next = new Set(prev);
      if (next.has(pId)) next.delete(pId);
      else next.add(pId);
      return next;
    });
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
      header: 'Status',
      render: (row) => (
        <span
          className="text-[12px] px-2 py-0.5 rounded-full font-semibold"
          style={{
            background:
              row.lastLogin === 'Active' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
            color: row.lastLogin === 'Active' ? '#34D399' : '#FBBF24',
          }}
        >
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
                onClick={() => handleDeleteStaff(row.id)}
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

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center gap-2">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--c1rcle-orange)', borderTopColor: 'transparent' }}
        />
        <span className="text-[13px]" style={{ color: 'var(--v-text-tertiary)' }}>
          Loading event team...
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-10">
      {/* ── Team Section (Staff) ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              className="text-[22px] font-bold tracking-tight"
              style={{ color: 'var(--v-text-primary)' }}
            >
              Event Staff
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
            disabled={staffLoading}
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

      {/* ── Promoter Section ── */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2
              className="text-[22px] font-bold tracking-tight"
              style={{ color: 'var(--v-text-primary)' }}
            >
              Promoters & Sales
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
              Monitor sales performance and comparison across promoters
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedPromoters.size > 0 && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Columns size={13} />}
                onClick={() => setCompareOpen(true)}
              >
                Compare Performance ({selectedPromoters.size})
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setAddPromoterOpen(true)}
            >
              Add Promoter to Event
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--v-text-tertiary)' }}
            />
            <input
              type="text"
              placeholder="Search promoters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-[13px] transition-colors"
              style={{
                background: 'var(--v-elevated)',
                border: '1px solid var(--v-border)',
                color: 'var(--v-text-primary)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--c1rcle-orange)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--v-border)')}
            />
          </div>

          <button
            onClick={toggleSelectAll}
            className="px-3.5 py-2 rounded-xl text-[12px] font-bold border transition-all flex items-center gap-1.5"
            style={{
              borderColor: 'var(--v-border)',
              background: allSelected ? 'var(--v-elevated)' : 'transparent',
              color: 'var(--v-text-secondary)',
            }}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Cards Grid */}
        {filteredPromoters.length === 0 ? (
          <div
            className="py-16 text-center border border-dashed rounded-3xl"
            style={{ borderColor: 'var(--v-border)' }}
          >
            <Users className="w-10 h-10 mx-auto text-[var(--v-text-tertiary)] opacity-40 mb-3" />
            <p className="text-[13px] font-semibold text-[var(--v-text-secondary)]">
              No promoters found
            </p>
            <p className="text-[12px] text-[var(--v-text-tertiary)] mt-1">
              Assign active promoters to start tracking sales.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPromoters.map((promoter) => {
              const confirmingRemove = removingPromoterId === promoter.promoterId;
              const isSelected = selectedPromoters.has(promoter.promoterId);

              return (
                <div
                  key={promoter.promoterId}
                  className="rounded-2xl border p-5 flex flex-col justify-between relative group transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{
                    background: 'var(--v-card)',
                    borderColor: isSelected ? 'var(--c1rcle-orange)' : 'var(--v-border)',
                    boxShadow: isSelected ? '0 0 12px rgba(249,115,22,0.12)' : 'none',
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={promoter.name} src={promoter.avatarUrl} size="md" />
                      <div>
                        <p
                          className="text-[14px] font-bold"
                          style={{ color: 'var(--v-text-primary)' }}
                        >
                          {promoter.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {promoter.code && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: 'var(--v-elevated)',
                                color: 'var(--c1rcle-orange)',
                              }}
                            >
                              {promoter.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(promoter.promoterId)}
                        className="w-4 h-4 rounded cursor-pointer accent-[var(--c1rcle-orange)]"
                      />
                      {confirmingRemove ? (
                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-lg p-0.5 ml-1">
                          <button
                            className="px-1.5 py-0.5 text-[10px] font-bold text-red-400 hover:text-red-300"
                            onClick={() => handleRemovePromoter(promoter.promoterId)}
                          >
                            Remove
                          </button>
                          <button
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-[var(--v-text-tertiary)]"
                            onClick={() => setRemovingPromoterId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <IconButton
                          icon={<Trash2 size={13} />}
                          aria-label="Remove promoter"
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 ml-1 transition-all"
                          onClick={() => setRemovingPromoterId(promoter.promoterId)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Card Stats Grid */}
                  <div
                    className="grid grid-cols-2 gap-4 my-5 py-4 border-y border-dashed"
                    style={{ borderColor: 'var(--v-border)' }}
                  >
                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: 'var(--v-text-tertiary)' }}
                      >
                        Tickets Sold
                      </p>
                      <p
                        className="text-[15px] font-extrabold mt-1 flex items-center gap-1.5"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        <Users size={14} className="text-zinc-500" />
                        {promoter.ticketsSold}
                      </p>
                    </div>

                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: 'var(--v-text-tertiary)' }}
                      >
                        Revenue Generated
                      </p>
                      <p
                        className="text-[15px] font-extrabold mt-1 flex items-center gap-1.5"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        <Coins size={14} className="text-amber-500" />
                        {formatINR(promoter.revenueGenerated)}
                      </p>
                    </div>

                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: 'var(--v-text-tertiary)' }}
                      >
                        RSVPs
                      </p>
                      <p
                        className="text-[15px] font-extrabold mt-1 flex items-center gap-1.5"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        <CheckCircle size={14} className="text-emerald-500" />
                        {promoter.rsvpCount}
                      </p>
                    </div>

                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: 'var(--v-text-tertiary)' }}
                      >
                        Conversion Rate
                      </p>
                      <p
                        className="text-[15px] font-extrabold mt-1 flex items-center gap-1.5"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        <TrendingUp size={14} className="text-orange-500" />
                        {promoter.conversionRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => setDetailPromoterId(promoter.promoterId)}
                  >
                    View Guest List & Analytics
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Modals ── */}
      <AddTeamMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddStaff}
      />

      {/* ── Add Promoter Modal ── */}
      {addPromoterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setAddPromoterOpen(false)}
        >
          <div
            className="w-full max-w-[450px] rounded-2xl overflow-hidden"
            style={{
              background: 'var(--v-card)',
              border: '1px solid var(--v-border)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b" style={{ borderColor: 'var(--v-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
                  Add Promoter to Event
                </h3>
                <IconButton
                  icon={<X size={15} />}
                  aria-label="Close"
                  variant="ghost"
                  onClick={() => setAddPromoterOpen(false)}
                />
              </div>
              <p className="text-[12px] mt-1" style={{ color: 'var(--v-text-tertiary)' }}>
                Select an approved partner promoter from your network to assign.
              </p>
            </div>

            <div className="p-6 max-h-[300px] overflow-y-auto space-y-3.5">
              {availablePromoters.length === 0 ? (
                <div className="py-8 text-center">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: 'var(--v-text-secondary)' }}
                  >
                    No available promoters
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
                    All connected promoters are already assigned, or you have no approved promoter
                    connections.
                  </p>
                </div>
              ) : (
                availablePromoters.map((p) => (
                  <div
                    key={p.promoterId}
                    className="flex items-center justify-between p-3 rounded-xl border hover:bg-[var(--v-elevated)] transition-colors"
                    style={{ borderColor: 'var(--v-border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={p.promoterName} src={p.photoURL} size="sm" />
                      <div>
                        <p
                          className="text-[13px] font-bold"
                          style={{ color: 'var(--v-text-primary)' }}
                        >
                          {p.promoterName}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--v-text-tertiary)' }}>
                          {p.promoterEmail || 'No email'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => handleAddPromoter(p.promoterId)}
                    >
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Promoter Detail View / Drawer ── */}
      {detailPromoter && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
          onClick={() => setDetailPromoterId(null)}
        >
          <div
            className="w-full max-w-[680px] h-full flex flex-col animate-in slide-in-from-right duration-200"
            style={{
              background: 'var(--v-card)',
              borderLeft: '1px solid var(--v-border)',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              className="p-6 border-b flex items-start justify-between"
              style={{ borderColor: 'var(--v-border)' }}
            >
              <div className="flex items-center gap-4">
                <Avatar name={detailPromoter.name} src={detailPromoter.avatarUrl} size="lg" />
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
                    {detailPromoter.name}
                  </h3>
                  <p
                    className="text-[12px] flex items-center gap-1.5 mt-0.5"
                    style={{ color: 'var(--v-text-tertiary)' }}
                  >
                    <span>
                      Promo Code:{' '}
                      <strong className="text-[var(--c1rcle-orange)]">
                        {detailPromoter.code || 'None'}
                      </strong>
                    </span>
                  </p>
                </div>
              </div>
              <IconButton
                icon={<X size={16} />}
                aria-label="Close details"
                variant="ghost"
                onClick={() => setDetailPromoterId(null)}
              />
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Performance Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Clicks
                  </p>
                  <p className="text-[16px] font-extrabold mt-1">{detailPromoter.clicks}</p>
                </div>
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
                    Tickets Sold
                  </p>
                  <p className="text-[16px] font-extrabold mt-1">{detailPromoter.ticketsSold}</p>
                </div>
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                    Revenue
                  </p>
                  <p className="text-[16px] font-extrabold mt-1">
                    {formatINR(detailPromoter.revenueGenerated)}
                  </p>
                </div>
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500">
                    RSVPs
                  </p>
                  <p className="text-[16px] font-extrabold mt-1">{detailPromoter.rsvpCount}</p>
                </div>
              </div>

              {/* Source Breakdown */}
              <div className="space-y-3">
                <h4
                  className="text-[13px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  Sales Source Distribution
                </h4>
                {detailPromoter.guests.length === 0 ? (
                  <p className="text-[12px]" style={{ color: 'var(--v-text-tertiary)' }}>
                    No orders data available to show distribution
                  </p>
                ) : (
                  (() => {
                    const total = detailPromoter.guests.length;
                    const manualCount = detailPromoter.guests.filter(
                      (g) => g.source === 'manual',
                    ).length;
                    // Mocking link vs promo code breakdown for visualization from remaining online orders
                    const onlineCount = total - manualCount;
                    const linkCount = Math.round(onlineCount * 0.75);
                    const codeCount = onlineCount - linkCount;

                    const linkPct = total > 0 ? (linkCount / total) * 100 : 0;
                    const codePct = total > 0 ? (codeCount / total) * 100 : 0;
                    const manualPct = total > 0 ? (manualCount / total) * 100 : 0;

                    return (
                      <div className="space-y-4">
                        {/* Progress stack */}
                        <div
                          className="h-4 rounded-full overflow-hidden flex"
                          style={{ background: 'var(--v-elevated)' }}
                        >
                          {linkPct > 0 && (
                            <div
                              className="h-full bg-orange-500"
                              style={{ width: `${linkPct}%` }}
                              title={`Link referrals: ${linkCount}`}
                            />
                          )}
                          {codePct > 0 && (
                            <div
                              className="h-full bg-amber-500"
                              style={{ width: `${codePct}%` }}
                              title={`Promo Code inputs: ${codeCount}`}
                            />
                          )}
                          {manualPct > 0 && (
                            <div
                              className="h-full bg-zinc-500"
                              style={{ width: `${manualPct}%` }}
                              title={`Manual registrations: ${manualCount}`}
                            />
                          )}
                        </div>
                        {/* Legend */}
                        <div
                          className="flex gap-6 text-[12px] font-medium"
                          style={{ color: 'var(--v-text-secondary)' }}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                            <span>Referral Links ({linkCount})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span>Promo Codes ({codeCount})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                            <span>Manual Entry ({manualCount})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Guest list table */}
              <div className="space-y-3">
                <h4
                  className="text-[13px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  Guest List ({detailPromoter.guests.length})
                </h4>
                {detailPromoter.guests.length === 0 ? (
                  <div
                    className="py-12 text-center border border-dashed rounded-2xl"
                    style={{ borderColor: 'var(--v-border)' }}
                  >
                    <p className="text-[12px]" style={{ color: 'var(--v-text-tertiary)' }}>
                      No guests have registered through this promoter yet.
                    </p>
                  </div>
                ) : (
                  <div
                    className="border rounded-2xl overflow-hidden"
                    style={{ borderColor: 'var(--v-border)' }}
                  >
                    <table className="w-full text-left">
                      <thead>
                        <tr
                          className="bg-[var(--v-elevated)] border-b border-subtle"
                          style={{ borderColor: 'var(--v-border)' }}
                        >
                          <th className="px-4 py-2.5 text-[11px] font-bold text-[var(--v-text-tertiary)]">
                            Guest Name
                          </th>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-[var(--v-text-tertiary)]">
                            Tickets
                          </th>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-[var(--v-text-tertiary)]">
                            Paid
                          </th>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-[var(--v-text-tertiary)]">
                            Check-in Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailPromoter.guests.map((guest: any) => {
                          const arrived = !!guest.checkedInAt;
                          return (
                            <tr
                              key={guest.id}
                              className="border-b last:border-0 hover:bg-[var(--v-elevated)]"
                              style={{ borderColor: 'var(--v-border)' }}
                            >
                              <td className="px-4 py-3 text-[12.5px] font-medium text-[var(--v-text-primary)]">
                                {guest.customerName}
                              </td>
                              <td className="px-4 py-3 text-[12.5px] font-medium text-[var(--v-text-secondary)]">
                                {guest.ticketsCount}
                              </td>
                              <td className="px-4 py-3 text-[12.5px] font-medium text-[var(--v-text-secondary)]">
                                {guest.amount > 0 ? formatINR(guest.amount) : 'Free/RSVP'}
                              </td>
                              <td className="px-4 py-3 text-[12px] font-bold">
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                                  style={{
                                    background: arrived
                                      ? 'rgba(52,211,153,0.1)'
                                      : 'rgba(251,191,36,0.1)',
                                    color: arrived ? '#34D399' : '#FBBF24',
                                  }}
                                >
                                  {arrived ? 'Arrived' : 'Not Arrived'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="p-6 border-t flex justify-end"
              style={{ borderColor: 'var(--v-border)' }}
            >
              <Button variant="secondary" onClick={() => setDetailPromoterId(null)}>
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Side-by-Side Comparison Modal ── */}
      {compareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="w-full max-w-[840px] rounded-2xl overflow-hidden"
            style={{
              background: 'var(--v-card)',
              border: '1px solid var(--v-border)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-6 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--v-border)' }}
            >
              <div>
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
                  Promoter Performance Matrix
                </h3>
                <p className="text-[12px] text-[var(--v-text-tertiary)] mt-0.5">
                  Side-by-side performance breakdown for selected event promoters
                </p>
              </div>
              <IconButton
                icon={<X size={15} />}
                aria-label="Close comparison"
                variant="ghost"
                onClick={() => setCompareOpen(false)}
              />
            </div>

            {/* Matrix Table */}
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--v-border)' }}>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--v-text-tertiary)] w-1/4">
                      Metric
                    </th>
                    {comparePromotersList.map((p) => (
                      <th
                        key={p.promoterId}
                        className="pb-3 px-4 text-[12px] font-bold text-[var(--v-text-primary)] text-center"
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                          <span className="truncate max-w-[120px]">{p.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Code */}
                  <tr className="border-b" style={{ borderColor: 'var(--v-border)' }}>
                    <td className="py-3 text-[12.5px] font-semibold text-[var(--v-text-secondary)]">
                      Promo Code
                    </td>
                    {comparePromotersList.map((p) => (
                      <td
                        key={p.promoterId}
                        className="py-3 px-4 text-[12px] font-bold text-[var(--c1rcle-orange)] text-center"
                      >
                        {p.code || '—'}
                      </td>
                    ))}
                  </tr>
                  {/* Clicks */}
                  <tr className="border-b" style={{ borderColor: 'var(--v-border)' }}>
                    <td className="py-3 text-[12.5px] font-semibold text-[var(--v-text-secondary)]">
                      Total Clicks
                    </td>
                    {comparePromotersList.map((p) => (
                      <td
                        key={p.promoterId}
                        className="py-3 px-4 text-[13px] font-semibold text-[var(--v-text-primary)] text-center"
                      >
                        {p.clicks}
                      </td>
                    ))}
                  </tr>
                  {/* Tickets Sold */}
                  <tr className="border-b" style={{ borderColor: 'var(--v-border)' }}>
                    <td className="py-3 text-[12.5px] font-semibold text-[var(--v-text-secondary)]">
                      Tickets Sold (Paid)
                    </td>
                    {comparePromotersList.map((p) => (
                      <td
                        key={p.promoterId}
                        className="py-3 px-4 text-[13px] font-bold text-center"
                        style={{ color: '#34D399' }}
                      >
                        {p.ticketsSold}
                      </td>
                    ))}
                  </tr>
                  {/* RSVPs */}
                  <tr className="border-b" style={{ borderColor: 'var(--v-border)' }}>
                    <td className="py-3 text-[12.5px] font-semibold text-[var(--v-text-secondary)]">
                      RSVPs Register
                    </td>
                    {comparePromotersList.map((p) => (
                      <td
                        key={p.promoterId}
                        className="py-3 px-4 text-[13px] font-bold text-center"
                        style={{ color: '#FBBF24' }}
                      >
                        {p.rsvpCount}
                      </td>
                    ))}
                  </tr>
                  {/* Revenue */}
                  <tr className="border-b" style={{ borderColor: 'var(--v-border)' }}>
                    <td className="py-3 text-[12.5px] font-semibold text-[var(--v-text-secondary)]">
                      Revenue Generated
                    </td>
                    {comparePromotersList.map((p) => (
                      <td
                        key={p.promoterId}
                        className="py-3 px-4 text-[13px] font-extrabold text-[var(--v-text-primary)] text-center"
                      >
                        {formatINR(p.revenueGenerated)}
                      </td>
                    ))}
                  </tr>
                  {/* Conversion */}
                  <tr className="border-b last:border-0" style={{ borderColor: 'var(--v-border)' }}>
                    <td className="py-3 text-[12.5px] font-semibold text-[var(--v-text-secondary)]">
                      Conversion %
                    </td>
                    {comparePromotersList.map((p) => (
                      <td
                        key={p.promoterId}
                        className="py-3 px-4 text-[13px] font-extrabold text-orange-500 text-center"
                      >
                        {p.conversionRate.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Footer */}
            <div
              className="p-6 border-t flex justify-end"
              style={{ borderColor: 'var(--v-border)' }}
            >
              <Button variant="secondary" onClick={() => setCompareOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
