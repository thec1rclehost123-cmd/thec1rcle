"use client";

import { useState, useEffect } from "react";
import {
    Users,
    UserPlus,
    Shield,
    ShieldCheck,
    Trash2,
    Edit3,
    Check,
    X,
    MoreHorizontal,
    Mail,
    Phone,
    Eye,
    EyeOff,
    AlertCircle
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface StaffMember {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    isVerified: boolean;
    isActive: boolean;
    permissions: Record<string, boolean>;
    createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
    manager: "Manager",
    floor_manager: "Floor Manager",
    security: "Security",
    ops: "Operations",
    finance: "Finance",
    viewer: "Viewer"
};

const ROLE_COLORS: Record<string, string> = {
    manager: "bg-purple-100 text-purple-700",
    floor_manager: "bg-blue-100 text-blue-700",
    security: "bg-amber-100 text-amber-700",
    ops: "bg-emerald-100 text-emerald-700",
    finance: "bg-rose-100 text-rose-700",
    viewer: "bg-slate-100 text-slate-700"
};

export default function VenueStaffPage() {
    const { profile } = useDashboardAuth();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [roleOptions, setRoleOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

    const venueId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (venueId) {
            fetchStaff();
        }
    }, [venueId]);

    const fetchStaff = async () => {
        try {
            const res = await fetch(`/api/venue/staff?venueId=${venueId}&isActive=all`);
            const data = await res.json();
            setStaff(data.staff || []);
            setRoleOptions(data.roleOptions || []);
        } catch (err) {
            console.error("Failed to fetch staff:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStaff = async (formData: { email: string; name: string; role: string; phone?: string }) => {
        try {
            const res = await fetch("/api/venue/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    venueId,
                    ...formData,
                    addedBy: {
                        uid: profile?.uid,
                        name: profile?.displayName,
                        email: profile?.email
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to add staff member");
                return;
            }

            setShowAddModal(false);
            fetchStaff();
        } catch (err) {
            console.error("Failed to add staff:", err);
        }
    };

    const handleAction = async (staffId: string, action: string) => {
        try {
            const res = await fetch("/api/venue/staff", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffId,
                    action,
                    updatedBy: {
                        uid: profile?.uid,
                        name: profile?.displayName
                    }
                })
            });

            if (res.ok) {
                fetchStaff();
            }
        } catch (err) {
            console.error(`Failed to ${action} staff:`, err);
        }
    };

    const activeStaff = staff.filter(s => s.isActive);
    const inactiveStaff = staff.filter(s => !s.isActive);

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-end justify-between border-b border-slate-200 pb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Staff Management</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage your venue's team and access permissions.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                    <UserPlus className="w-4 h-4" />
                    Add Staff Member
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Staff" value={activeStaff.length} icon={Users} />
                <StatCard label="Verified" value={activeStaff.filter(s => s.isVerified).length} icon={ShieldCheck} />
                <StatCard label="Pending Verification" value={activeStaff.filter(s => !s.isVerified).length} icon={Shield} />
                <StatCard label="Inactive" value={inactiveStaff.length} icon={EyeOff} />
            </div>

            {/* Staff List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900">Active Staff ({activeStaff.length})</h2>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-pulse text-slate-400">Loading staff...</div>
                    </div>
                ) : activeStaff.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No staff members yet</h3>
                        <p className="text-slate-500 text-sm">Add your first team member to get started.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {activeStaff.map(member => (
                            <StaffRow
                                key={member.id}
                                member={member}
                                onVerify={() => handleAction(member.id, "verify")}
                                onRemove={() => handleAction(member.id, "remove")}
                                onEdit={() => setSelectedStaff(member)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Inactive Staff */}
            {inactiveStaff.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-500">Inactive Staff ({inactiveStaff.length})</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {inactiveStaff.map(member => (
                            <StaffRow key={member.id} member={member} inactive />
                        ))}
                    </div>
                </div>
            )}

            {/* Add Staff Modal */}
            {showAddModal && (
                <AddStaffModal
                    roleOptions={roleOptions}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddStaff}
                />
            )}
        </div>
    );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                </div>
            </div>
        </div>
    );
}

function StaffRow({
    member,
    onVerify,
    onRemove,
    onEdit,
    inactive = false
}: {
    member: StaffMember;
    onVerify?: () => void;
    onRemove?: () => void;
    onEdit?: () => void;
    inactive?: boolean;
}) {
    const [showActions, setShowActions] = useState(false);

    return (
        <div className={`px-6 py-4 flex items-center justify-between ${inactive ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{member.name}</h4>
                        {member.isVerified && (
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {member.email}
                        </span>
                        {member.phone && (
                            <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {member.phone}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[member.role] || ROLE_COLORS.viewer}`}>
                    {ROLE_LABELS[member.role] || member.role}
                </span>

                {!inactive && (
                    <div className="relative">
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <MoreHorizontal className="w-4 h-4 text-slate-400" />
                        </button>

                        {showActions && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-10 min-w-[160px]">
                                {!member.isVerified && onVerify && (
                                    <button
                                        onClick={() => { onVerify(); setShowActions(false); }}
                                        className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verify
                                    </button>
                                )}
                                {onEdit && (
                                    <button
                                        onClick={() => { onEdit(); setShowActions(false); }}
                                        className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <Edit3 className="w-4 h-4" /> Edit Role
                                    </button>
                                )}
                                {onRemove && (
                                    <button
                                        onClick={() => { onRemove(); setShowActions(false); }}
                                        className="w-full px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Remove
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AddStaffModal({
    roleOptions,
    onClose,
    onSubmit
}: {
    roleOptions: string[];
    onClose: () => void;
    onSubmit: (data: { email: string; name: string; role: string; phone?: string }) => void;
}) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState(roleOptions[0] || "viewer");
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit({ email, name, role, phone });
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Add Staff Member</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="John Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="john@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone (Optional)</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="+91 98765 43210"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            {roleOptions.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 mt-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                            <p className="text-xs text-slate-500">
                                An email invitation will be sent to the staff member. They'll need to create an account
                                or log in to access the dashboard with their assigned permissions.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Adding..." : "Add Staff"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
