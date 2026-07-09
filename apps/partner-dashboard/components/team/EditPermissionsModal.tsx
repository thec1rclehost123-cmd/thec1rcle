'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HOST_PERMISSIONS, VENUE_PERMISSIONS } from '@/lib/rbac/types';
import type { HostRole, Permission, VenueRole } from '@/lib/rbac/types';

type EditableVenueRole = Exclude<VenueRole, 'OWNER' | 'STAFF'>;
type EditableHostRole = Exclude<HostRole, 'OWNER'>;

const PERMISSION_LABELS: Record<Permission, string> = {
  VIEW_FINANCIALS: 'Can see revenue and payout information',
  MANAGE_STAFF: 'Can manage the team',
  MANAGE_EVENTS: 'Can create and update events',
  EDIT_EVENT_RULES: 'Can change rules and event settings',
  MANAGE_TABLES: 'Can manage tables and floor setup',
  VIEW_GUESTLIST: 'Can view guest lists and door activity',
  SCAN_ENTRY: 'Can handle entry scanning',
  LOG_INCIDENTS: 'Can log issues and incident notes',
  VIEW_ANALYTICS: 'Can view performance analytics',
  MANAGE_SETTINGS: 'Can update venue settings',
  MANAGE_PROMOTERS: 'Can manage promoter relationships',
  MANAGE_PAYOUTS: 'Can manage payouts',
  MANAGE_PARTNERSHIPS: 'Can manage partnerships',
  MANAGE_PAGE_CONTENT: 'Can update public page content',
  VIEW_REAL_TIME_SCANS: 'Can monitor live scanning',
  MANAGE_GUEST_OPS: 'Can manage guest operations',
  EXPORT_GUESTS: 'Can export guest data',
};

const VENUE_ROLE_OPTIONS: Array<{ value: EditableVenueRole; label: string; description: string }> =
  [
    {
      value: 'MANAGER',
      label: 'Manager',
      description:
        'Best for day-to-day operators handling events, guests, and live floor decisions.',
    },
    {
      value: 'FINANCE_ADMIN',
      label: 'Finance',
      description:
        'Best for trusted finance support who need money visibility without running the floor.',
    },
    {
      value: 'SECURITY',
      label: 'Security',
      description: 'Best for door and safety staff focused on guest flow and incident awareness.',
    },
    {
      value: 'DOOR',
      label: 'Door',
      description:
        'Best for door managers and check-in staff focused on guest entry and front-of-house flow.',
    },
  ];

const HOST_ROLE_OPTIONS: Array<{ value: EditableHostRole; label: string; description: string }> = [
  {
    value: 'COHOST',
    label: 'Co-Host',
    description: 'Can help lead events, work with promoters, and support overall host operations.',
  },
  {
    value: 'MANAGER',
    label: 'Manager',
    description: 'Can run day-to-day event work and oversee guests and live activity.',
  },
  {
    value: 'STAFF',
    label: 'Staff',
    description: 'Can help with guest-facing event tasks and essential door operations.',
  },
];

interface VenueEditProps {
  partnerType: 'venue';
  memberId: string;
  memberName: string;
  currentRole: VenueRole;
  onSave: (role: EditableVenueRole) => Promise<void>;
  onClose: () => void;
}

interface HostEditProps {
  partnerType: 'host';
  memberId: string;
  memberName: string;
  currentRole: HostRole;
  membershipId: string;
  onSave: (role: EditableHostRole) => Promise<void>;
  onClose: () => void;
}

type EditPermissionsModalProps = VenueEditProps | HostEditProps;

function CapabilityList({ permissions }: { permissions: Permission[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {permissions.map((permission) => (
        <div
          key={permission}
          className="flex items-center gap-3 rounded-[22px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-4 py-3"
        >
          <CheckCircle2 size={18} className="shrink-0 text-[var(--c1rcle-orange)]" />
          <span className="text-sm font-medium text-[var(--v-text-primary)]">
            {PERMISSION_LABELS[permission] ?? permission}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EditPermissionsModal(props: EditPermissionsModalProps) {
  const [saving, setSaving] = useState(false);

  const isVenue = props.partnerType === 'venue';

  const venueInitialRole: EditableVenueRole =
    props.partnerType === 'venue' && props.currentRole !== 'OWNER' && props.currentRole !== 'STAFF'
      ? props.currentRole
      : 'MANAGER';
  const hostInitialRole: EditableHostRole =
    props.partnerType === 'host' && props.currentRole !== 'OWNER' ? props.currentRole : 'MANAGER';

  const [selectedVenueRole, setSelectedVenueRole] = useState<EditableVenueRole>(venueInitialRole);
  const [selectedHostRole, setSelectedHostRole] = useState<EditableHostRole>(hostInitialRole);

  const roleOptions = isVenue ? VENUE_ROLE_OPTIONS : HOST_ROLE_OPTIONS;
  const selectedRole = isVenue ? selectedVenueRole : selectedHostRole;

  const selectedPermissions = useMemo(() => {
    if (isVenue) return VENUE_PERMISSIONS[selectedVenueRole] ?? [];
    return HOST_PERMISSIONS[selectedHostRole] ?? [];
  }, [isVenue, selectedHostRole, selectedVenueRole]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isVenue) {
        await (props as VenueEditProps).onSave(selectedVenueRole);
      } else {
        await (props as HostEditProps).onSave(selectedHostRole);
      }
      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[36px] border border-[var(--v-border)] bg-[var(--v-card)] shadow-[0_0_80px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--v-border)] px-8 py-7">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--c1rcle-orange)]">
              Edit Access
            </p>
            <h2 className="mt-2 text-[30px] font-black tracking-tight text-[var(--v-text-primary)]">
              Choose what {props.memberName} should help with
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--v-text-secondary)]">
              Keep it simple. Pick the role that best matches this person&apos;s responsibilities.
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)] p-3 text-[var(--v-text-secondary)] transition-all hover:text-[var(--v-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-7">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--v-text-tertiary)]">
                Roles
              </h3>
              <div className="space-y-3">
                {roleOptions.map((option) => {
                  const active = selectedRole === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        isVenue
                          ? setSelectedVenueRole(option.value as EditableVenueRole)
                          : setSelectedHostRole(option.value as EditableHostRole)
                      }
                      className={cn(
                        'w-full rounded-[26px] border p-5 text-left transition-all',
                        active
                          ? 'border-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange)]/10'
                          : 'border-[var(--v-border)] bg-[var(--v-elevated)] hover:border-[var(--c1rcle-orange)]/30',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                            active
                              ? 'bg-[var(--c1rcle-orange)] text-white'
                              : 'bg-black/20 text-[var(--v-text-secondary)]',
                          )}
                        >
                          <Shield size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-bold text-[var(--v-text-primary)]">
                            {option.label}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[var(--v-text-secondary)]">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--v-text-tertiary)]">
                This Role Can Do
              </h3>
              <div className="rounded-[28px] border border-[var(--v-border)] bg-[var(--v-card)] p-5">
                <p className="mb-4 text-xl font-bold text-[var(--v-text-primary)]">
                  {roleOptions.find((option) => option.value === selectedRole)?.label}
                </p>
                <CapabilityList permissions={selectedPermissions} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-[var(--v-border)] px-8 py-6">
          <button
            onClick={props.onClose}
            className="flex-1 rounded-2xl py-3 text-sm font-bold uppercase tracking-[0.18em] text-[var(--v-text-secondary)] transition-colors hover:text-[var(--v-text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[1.5] rounded-2xl bg-[var(--c1rcle-orange)] py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-all disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Access'}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
