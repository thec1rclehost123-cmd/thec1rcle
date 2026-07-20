'use client';

import { useState } from 'react';
import { X, Mail, User, Shield } from 'lucide-react';

// Local StaffRole type matching the roles used in this component
type VenueStaffRole =
  | 'OWNER'
  | 'CLUB_MANAGER'
  | 'FLOOR_MANAGER'
  | 'TABLE_MANAGER'
  | 'SECURITY'
  | 'OPS_STAFF';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (staffData: { email: string; displayName: string; role: VenueStaffRole }) => Promise<void>;
}

const ROLE_OPTIONS: { value: VenueStaffRole; label: string; description: string }[] = [
  {
    value: 'OWNER',
    label: 'Owner',
    description: 'Full access to all features including financials and staff management',
  },
  {
    value: 'CLUB_MANAGER',
    label: 'Venue Manager',
    description: 'Can manage events, tables, and operations. No staff management.',
  },
  {
    value: 'FLOOR_MANAGER',
    label: 'Floor Manager',
    description: 'Can manage events, tables, and entry. Limited analytics.',
  },
  {
    value: 'TABLE_MANAGER',
    label: 'Table Manager',
    description: 'Can only manage table assignments and reservations',
  },
  {
    value: 'SECURITY',
    label: 'Security/Bouncer',
    description: 'Can scan entries, view guestlist, and log incidents',
  },
  {
    value: 'OPS_STAFF',
    label: 'Operations Staff',
    description: 'View-only access to registers and logs',
  },
];

export function AddStaffModal({ isOpen, onClose, onAdd }: AddStaffModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<VenueStaffRole>('FLOOR_MANAGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onAdd({
        email: email.trim(),
        displayName: displayName.trim(),
        role: selectedRole,
      });

      // Reset form
      setEmail('');
      setDisplayName('');
      setSelectedRole('FLOOR_MANAGER');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add staff member');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface-elevated rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-elevated border-b border-border-default p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Add Staff Member</h2>
            <p className="text-sm text-text-tertiary mt-1">Grant access to your club dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-surface-tertiary border border-border-default rounded-lg text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="staff@example.com"
              />
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              They will receive an invitation email to set up their account
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-surface-tertiary border border-border-default rounded-lg text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-3">
              Access Role *
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedRole === option.value
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-border-default hover:border-border-strong bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={selectedRole === option.value}
                      onChange={(e) => setSelectedRole(e.target.value as VenueStaffRole)}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-text-tertiary" />
                        <span className="font-semibold text-text-primary text-sm">
                          {option.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{option.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-surface-elevated border border-border-default rounded-lg text-text-secondary font-semibold hover:bg-surface-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-indigo-600 text-text-primary font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
