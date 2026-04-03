"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";

const VENUE_ROLES: Record<string, string> = {
    STAFF:         "Staff",
    FINANCE_ADMIN: "Finance Admin",
    manager:       "Manager",
    supervisor:    "Supervisor",
    security:      "Security",
    scanner:       "Scanner",
    door_staff:    "Door Staff",
};

const HOST_ROLES: Record<string, string> = {
    COHOST: "Co-Host",
    STAFF:  "Staff",
};

interface AddTeamMemberModalProps {
    partnerType: "venue" | "host";
    onClose: () => void;
    onSubmit: (data: { email: string; name: string; role: string }) => Promise<void>;
}

export function AddTeamMemberModal({ partnerType, onClose, onSubmit }: AddTeamMemberModalProps) {
    const roles = partnerType === "venue" ? VENUE_ROLES : HOST_ROLES;
    const defaultRole = partnerType === "venue" ? "STAFF" : "STAFF";

    const [formData, setFormData] = useState({ name: "", email: "", role: defaultRole });
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await onSubmit(formData);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                className="max-w-md w-full bg-[var(--v-card)] rounded-[2.5rem] border border-[var(--v-border)] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden"
            >
                <div className="px-8 py-6 border-b border-[var(--v-border)] flex items-center justify-between bg-[var(--v-elevated)]/30">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--v-text-primary)] tracking-tight">Add Team Member</h3>
                        <p className="text-sm text-text-tertiary mt-0.5">Send a secure platform invitation</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--v-elevated)] rounded-2xl transition-all text-text-tertiary hover:text-text-primary">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Full Name</label>
                        <input
                            required
                            type="text"
                            placeholder="Jane Smith"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-[var(--v-elevated)] border border-[var(--v-border)] rounded-2xl px-5 py-4 text-base font-bold text-[var(--v-text-primary)] focus:border-[var(--c1rcle-orange)] focus:ring-4 focus:ring-[var(--c1rcle-orange)]/10 transition-all outline-none placeholder:text-text-placeholder placeholder:font-normal"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Email Address</label>
                        <input
                            required
                            type="email"
                            placeholder="jane@example.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-[var(--v-elevated)] border border-[var(--v-border)] rounded-2xl px-5 py-4 text-base font-bold text-[var(--v-text-primary)] focus:border-[var(--c1rcle-orange)] focus:ring-4 focus:ring-[var(--c1rcle-orange)]/10 transition-all outline-none placeholder:text-text-placeholder placeholder:font-normal"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Role</label>
                        <select
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full bg-[var(--v-elevated)] border border-[var(--v-border)] rounded-2xl px-5 py-4 text-base font-bold text-[var(--v-text-primary)] focus:border-[var(--c1rcle-orange)] focus:ring-4 focus:ring-[var(--c1rcle-orange)]/10 transition-all outline-none appearance-none cursor-pointer"
                        >
                            {Object.entries(roles).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 text-sm font-bold text-text-secondary hover:text-text-primary uppercase tracking-[0.1em] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="flex-[2] bg-[var(--c1rcle-orange)] text-white py-4 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-[var(--c1rcle-orange)]/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            {busy ? "Sending..." : "Send Invitation"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
