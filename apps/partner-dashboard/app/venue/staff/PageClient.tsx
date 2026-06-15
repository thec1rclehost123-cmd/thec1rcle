'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Trash2,
  X,
  MoreHorizontal,
  Mail,
  AlertCircle,
  Loader2,
  PauseCircle,
  PlayCircle,
  Clock,
  ChevronDown,
  Plus,
} from 'lucide-react';
import type { StaffProfile } from '@/lib/types/staffProfile';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { BentoCard } from '@/components/ui/BentoCard';
import ProfilesView from '@/app/venue/staff/StaffProfilesView';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  status: 'invited' | 'pending_verification' | 'active' | 'suspended' | 'removed';
  verified: boolean;
  userId?: string;
  invitedBy?: { uid: string; name: string };
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  STAFF: 'Employee',
  FINANCE_ADMIN: 'Finance',
  manager: 'Manager',
  supervisor: 'Supervisor',
  security: 'Security',
  scanner: 'Scanner',
  door_staff: 'Door Staff',
  owner: 'Owner',
};

const ACTION_ICON_MAP: Record<string, any> = {
  verify: ShieldCheck,
  suspend: PauseCircle,
  reactivate: PlayCircle,
  remove: Trash2,
};

export default function VenueStaffPage({
  setActions,
}: {
  setActions: (actions: React.ReactNode) => void;
}) {
  const { profile, user } = useDashboardAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [activeView, setActiveView] = useState<'members' | 'profiles'>('members');

  const venueId = profile?.activeMembership?.partnerId;

  useEffect(() => {
    setActions(
      <VenueActionButton
        variant="primary"
        onClick={() => setShowAddModal(true)}
        className="shadow-lg shadow-accent-primary/20"
      >
        <Plus className="w-4 h-4 mr-2" /> Add Team Member
      </VenueActionButton>,
    );
    return () => setActions(null);
  }, [setActions]);

  useEffect(() => {
    if (venueId) {
      fetchStaff();
      fetchProfiles();
    }
  }, [venueId]);

  const fetchStaff = async () => {
    try {
      const token = user ? await user.getIdToken() : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/partners/venues/staff?venueId=${venueId}&isActive=all`, {
        headers,
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const token = user ? await user.getIdToken() : null;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/partners/venues/staff-profiles?venueId=${venueId}`, {
        headers,
      });
      if (!res.ok) return;
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {}
  };

  const handleAddStaff = async (formData: { email: string; name: string; role: string }) => {
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch('/api/partners/venues/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          venueId,
          ...formData,
          addedBy: { uid: profile?.uid, name: profile?.displayName },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to add staff member');
        return;
      }
      setShowAddModal(false);
      fetchStaff();
    } catch (err) {
      console.error('Failed to add staff:', err);
    }
  };

  const handleAction = async (staffId: string, action: string) => {
    if (
      action === 'remove' &&
      !confirm('Are you sure? This will permanently revoke all access for this user.')
    )
      return;

    setActionLoading(staffId + action);
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch('/api/partners/venues/staff', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          staffId,
          action,
          updatedBy: { uid: profile?.uid, name: profile?.displayName },
        }),
      });
      if (res.ok) {
        fetchStaff();
      }
    } catch (err) {
      console.error(`Failed to ${action} staff:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && staff.length === 0) {
    return (
      <div className="py-32 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
        <div className="relative">
          <div className="absolute inset-0 bg-accent-primary/20 blur-2xl rounded-full" />
          <Loader2 className="h-12 w-12 text-accent-primary animate-spin relative" />
        </div>
        <p className="text-text-tertiary font-black uppercase tracking-[0.2em] text-[10px] mt-8">
          Synchronizing Force Registry
        </p>
      </div>
    );
  }

  const activeStaff = staff.filter(
    (s) => s.status === 'active' || s.status === 'pending_verification' || s.status === 'invited',
  );
  const suspendedStaff = staff.filter((s) => s.status === 'suspended');

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* View Architecture Switcher */}
      <div className="flex p-1.5 bg-surface-secondary/50 backdrop-blur-md rounded-2xl gap-1 border border-border-subtle inline-flex shadow-inner">
        {[
          { id: 'members', label: 'Operational Team', icon: Users },
          { id: 'profiles', label: 'Access Profiles', icon: ShieldCheck },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as any)}
            className={cn(
              'flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all',
              activeView === view.id
                ? 'bg-surface-elevated text-text-primary shadow-lg border border-border-default scale-[1.02]'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary',
            )}
          >
            <view.icon
              className={cn(
                'w-4 h-4',
                activeView === view.id ? 'text-accent-primary' : 'text-text-tertiary',
              )}
            />
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'members' ? (
          <motion.div
            key="members"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-10"
          >
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  label: 'Force Strength',
                  value: staff.filter((s) => s.status === 'active').length,
                  icon: Users,
                  color: 'text-accent-primary',
                },
                {
                  label: 'Verified Key',
                  value: staff.filter((s) => s.verified).length,
                  icon: ShieldCheck,
                  color: 'text-emerald-500',
                },
                {
                  label: 'Pending Entry',
                  value: staff.filter((s) => s.status === 'invited').length,
                  icon: Clock,
                  color: 'text-amber-500',
                },
                {
                  label: 'Security Tier',
                  value: 'Level 4',
                  icon: Shield,
                  color: 'text-text-primary',
                },
              ].map((kpi, i) => (
                <BentoCard key={i} padding="lg" className="relative group overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity rotate-12">
                    <kpi.icon size={120} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary mb-2">
                    {kpi.label}
                  </p>
                  <div className="flex items-end justify-between">
                    <h4
                      className={cn('text-4xl font-black tabular-nums tracking-tighter', kpi.color)}
                    >
                      {kpi.value}
                    </h4>
                    <kpi.icon size={20} className={cn('opacity-40 mb-1', kpi.color)} />
                  </div>
                </BentoCard>
              ))}
            </div>

            {/* Staff Ledger */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-text-tertiary">
                  Active Personnel Registry
                </h3>
                <div className="h-px flex-1 mx-6 bg-border-subtle" />
                <span className="text-[10px] font-bold text-text-placeholder italic">
                  Showing {activeStaff.length} entities
                </span>
              </div>

              <BentoCard className="overflow-hidden shadow-2xl border-border-default">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-secondary/40 border-b border-border-subtle text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">
                        <th className="px-8 py-5">Personnel ID & Role</th>
                        <th className="px-8 py-5">Verified Status</th>
                        <th className="px-8 py-5">Communication</th>
                        <th className="px-8 py-5 text-right">System Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {activeStaff.map((member) => (
                        <tr
                          key={member.id}
                          className="group hover:bg-surface-secondary/40 transition-all duration-300"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-surface-tertiary border border-border-default flex items-center justify-center font-black text-xs text-text-primary group-hover:scale-105 transition-transform group-hover:shadow-lg group-hover:border-accent-primary/20">
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-base font-bold text-text-primary mb-0.5 leading-tight group-hover:text-accent-primary transition-colors">
                                  {member.name}
                                </p>
                                <span className="px-2 py-0.5 rounded-lg bg-surface-elevated border border-border-subtle text-[10px] font-black uppercase tracking-wider text-text-tertiary">
                                  {ROLE_LABELS[member.role] || member.role}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  member.status === 'active'
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : member.status === 'invited'
                                      ? 'bg-amber-500'
                                      : 'bg-text-placeholder',
                                )}
                              />
                              <span className="text-sm font-bold text-text-secondary capitalize">
                                {member.status.replace('_', ' ')}
                              </span>
                              {member.verified && (
                                <ShieldCheck size={14} className="text-emerald-500" />
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-medium text-text-tertiary">{member.email}</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                              {member.status === 'active' && (
                                <button
                                  onClick={() => handleAction(member.id, 'suspend')}
                                  disabled={actionLoading === member.id + 'suspend'}
                                  className="p-2.5 hover:bg-amber-500/10 rounded-xl text-text-tertiary hover:text-amber-500 transition-all"
                                  title="Suspend Access"
                                >
                                  {actionLoading === member.id + 'suspend' ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : (
                                    <PauseCircle size={18} />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleAction(member.id, 'remove')}
                                disabled={actionLoading === member.id + 'remove'}
                                className="p-2.5 hover:bg-red-500/10 rounded-xl text-text-tertiary hover:text-red-500 transition-all"
                                title="Revoke Permission"
                              >
                                {actionLoading === member.id + 'remove' ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </BentoCard>

              {suspendedStaff.length > 0 && (
                <div className="pt-8 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between px-2 mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                      Deactivated Personnel
                    </h3>
                    <div className="h-px flex-1 mx-6 bg-red-500/10" />
                  </div>
                  <BentoCard className="overflow-hidden bg-red-500/[0.02] border-red-500/10">
                    <div className="divide-y divide-red-500/5">
                      {suspendedStaff.map((member) => (
                        <div
                          key={member.id}
                          className="px-8 py-4 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-surface-tertiary border border-border-default flex items-center justify-center font-black text-[10px] text-text-placeholder">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-secondary line-through">
                                {member.name}
                              </p>
                              <p className="text-[10px] text-text-placeholder">{member.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAction(member.id, 'reactivate')}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
                          >
                            Reactivate
                          </button>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="profiles"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <ProfilesView />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <AddStaffModal onClose={() => setShowAddModal(false)} onSubmit={handleAddStaff} />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddStaffModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({ name: '', email: '', role: 'STAFF' });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    await onSubmit(formData);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-surface-elevated rounded-[2.5rem] border border-border-default shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <div className="p-8 border-b border-border-subtle flex items-center justify-between bg-surface-secondary/30">
          <div>
            <h3 className="text-xl font-bold text-text-primary tracking-tight">
              Recruit Team Member
            </h3>
            <p className="text-sm text-text-tertiary mt-1">Issue a secure platform invitation</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-tertiary rounded-2xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">
              Full Legal Name
            </label>
            <input
              required
              type="text"
              className="w-full bg-surface-secondary border border-border-default rounded-2xl px-5 py-4 text-base font-bold text-text-primary focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all outline-none"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">
              Work Email Address
            </label>
            <input
              required
              type="email"
              className="w-full bg-surface-secondary border border-border-default rounded-2xl px-5 py-4 text-base font-bold text-text-primary focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all outline-none"
              placeholder="john@venue.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">
              Deployment Role
            </label>
            <select
              className="w-full bg-surface-secondary border border-border-default rounded-2xl px-5 py-4 text-base font-bold text-text-primary focus:border-accent-primary focus:ring-4 focus:ring-accent-primary/10 transition-all outline-none"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-sm font-bold text-text-secondary hover:text-text-primary uppercase tracking-[0.1em] transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-[2] bg-accent-primary text-white py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? 'Deploying...' : 'Send Secure Invitation'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
