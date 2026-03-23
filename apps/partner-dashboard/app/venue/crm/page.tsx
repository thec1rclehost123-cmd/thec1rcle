"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Users, Wifi, LayoutList, UserPlus,
    Clock, Phone, Mail, ChevronRight, AlertCircle, Loader2,
} from "lucide-react";
import type { User } from "firebase/auth";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { OnlineCustomer } from "@/app/api/venue/crm/online/route";
import type { ManualCustomer } from "@/app/api/venue/crm/customers/route";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CRMTab = "online" | "total" | "manual";

interface CRMData {
    online: OnlineCustomer[];
    manual: ManualCustomer[];
    loading: boolean;
    error: string | null;
}

interface FormState {
    name: string; email: string; phone: string; dob: string; eventAppeared: string;
}

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", dob: "", eventAppeared: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// Auth-aware fetch
// ─────────────────────────────────────────────────────────────────────────────

async function authFetch(user: User, url: string, init?: RequestInit): Promise<Response> {
    const token = await user.getIdToken();
    return fetch(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function calculateAge(dob: string): number {
    if (!dob) return 0;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
    const initials = name.split(" ").map((n) => n[0] ?? "").slice(0, 2).join("").toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-secondary)" }}>
            {initials}
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        checked_in: { bg: "rgba(52,211,153,0.1)",  color: "var(--v-success)", label: "Checked In" },
        confirmed:  { bg: "rgba(129,140,248,0.1)", color: "var(--v-info)",    label: "Confirmed"  },
        completed:  { bg: "rgba(251,191,36,0.1)",  color: "var(--v-warning)", label: "Completed"  },
    };
    const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--v-text-tertiary)", label: status };
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            style={{ background: s.bg, color: s.color }}>{s.label}</span>
    );
}

function AgeBadge({ age }: { age: number }) {
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-secondary)" }}>
            {age > 0 ? `${age} yrs` : "—"}
        </span>
    );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--v-elevated)" }}>
                <Icon size={24} style={{ color: "var(--v-text-tertiary)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--v-text-tertiary)" }}>{message}</p>
        </div>
    );
}

function SkeletonRows({ cols }: { cols: number }) {
    return (
        <>
            {[...Array(4)].map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--v-border)" }}>
                    {[...Array(cols)].map((__, j) => (
                        <td key={j} className="px-4 py-3">
                            <div className="h-4 rounded-md animate-pulse"
                                style={{ background: "var(--v-elevated)", width: j === 0 ? "55%" : j === cols - 1 ? "35%" : "70%" }} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] font-medium"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--v-error)" }}>
            <AlertCircle size={16} className="shrink-0" />
            {message}
        </div>
    );
}

// ── Table shell ───────────────────────────────────────────────────────────────

function CustomerTable({
    headers, count, loading, icon: Icon, label, children, emptyIcon, emptyMessage,
}: {
    headers: string[]; count: number; loading: boolean;
    icon: React.ElementType; label: string; children: React.ReactNode;
    emptyIcon?: React.ElementType; emptyMessage?: string;
}) {
    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ background: "var(--v-card)", border: "1px solid var(--v-border)", boxShadow: "var(--v-shadow-card)" }}>
            {/* Header bar */}
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--v-elevated)" }}>
                    <Icon size={15} style={{ color: "var(--v-text-secondary)" }} />
                </div>
                <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{label}</span>
                {loading
                    ? <Loader2 size={13} className="ml-1 animate-spin" style={{ color: "var(--v-text-tertiary)" }} />
                    : <span className="ml-auto text-[11px] font-bold" style={{ color: "var(--v-text-tertiary)" }}>
                        {count} record{count !== 1 ? "s" : ""}
                      </span>
                }
            </div>
            {/* Table */}
            <div className="overflow-x-auto">
                {!loading && count === 0 ? (
                    <EmptyState icon={emptyIcon ?? Icon} message={emptyMessage ?? "No records found"} />
                ) : (
                    <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--v-border)", background: "var(--v-elevated)" }}>
                                {headers.map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                                        style={{ color: "var(--v-text-tertiary)" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{loading ? <SkeletonRows cols={headers.length} /> : children}</tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const rowProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "var(--v-card-hover)"; },
    onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "transparent"; },
    className: "transition-colors duration-100",
    style: { borderBottom: "1px solid var(--v-border)" } as React.CSSProperties,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab content — props-driven, no internal fetching
// ─────────────────────────────────────────────────────────────────────────────

function OnlineTab({ data }: { data: CRMData }) {
    if (data.error) return <ErrorBanner message={data.error} />;
    return (
        <CustomerTable headers={["Name", "Email", "Phone", "Age", "Event", "Entry Time", "Status"]}
            count={data.online.length} loading={data.loading} icon={Wifi} label="Online Customers"
            emptyMessage="No ticket purchases or check-ins found">
            {data.online.map((c) => {
                console.log("Customer Data:", c);
                const displayAge = c.age ?? (c.dob ? calculateAge(c.dob) : 0);
                return (
                    <tr key={c.id} {...rowProps}>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Avatar name={c.name} />
                                <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{c.name}</span>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                            <span className="flex items-center gap-1.5">
                                <Mail size={11} style={{ color: "var(--v-text-tertiary)", flexShrink: 0 }} />{c.email || "—"}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                            <span className="flex items-center gap-1.5">
                                <Phone size={11} style={{ color: "var(--v-text-tertiary)", flexShrink: 0 }} />{c.phone || "—"}
                            </span>
                        </td>
                        <td className="px-4 py-3">
                            {displayAge > 0 ? <AgeBadge age={displayAge} /> : <span style={{ color: "var(--v-text-tertiary)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "var(--v-text-primary)" }}>{c.eventName}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>
                            <span className="flex items-center gap-1.5">
                                <Clock size={11} style={{ color: "var(--v-text-tertiary)", flexShrink: 0 }} />
                                {c.entryTime ? `${fmtDate(c.entryTime)}, ${fmtTime(c.entryTime)}` : "—"}
                            </span>
                        </td>
                        <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                    </tr>
                );
            })}
        </CustomerTable>
    );
}

function TotalTab({ data }: { data: CRMData }) {
    const merged = useMemo(() => {
        type Row = { id: string; name: string; email: string; phone: string; dob: string; source: "online" | "manual" };
        const rows: Row[] = [];
        const seen = new Set<string>();
        for (const c of data.online) {
            rows.push({ id: c.id, name: c.name, email: c.email, phone: c.phone, dob: "", source: "online" });
            if (c.email) seen.add(c.email.toLowerCase());
        }
        for (const c of data.manual) {
            if (!seen.has(c.email.toLowerCase())) {
                rows.push({ id: c.id, name: c.name, email: c.email, phone: c.phone, dob: c.dob, source: "manual" });
            }
        }
        return rows;
    }, [data.online, data.manual]);

    if (data.error) return <ErrorBanner message={data.error} />;
    return (
        <CustomerTable headers={["Name", "Email", "Phone", "Date of Birth", "Age", "Source"]}
            count={merged.length} loading={data.loading} icon={Users} label="All Customers"
            emptyMessage="No customers found across online and manual records">
            {merged.map((c) => {
                const age = calculateAge(c.dob);
                return (
                    <tr key={`${c.source}-${c.id}`} {...rowProps}>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Avatar name={c.name} />
                                <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{c.name}</span>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.email || "—"}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.phone || "—"}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.dob ? fmtDate(c.dob) : "—"}</td>
                        <td className="px-4 py-3">
                            {c.dob ? <AgeBadge age={age} /> : <span style={{ color: "var(--v-text-tertiary)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                                style={{
                                    background: c.source === "online" ? "rgba(129,140,248,0.1)" : "rgba(244,74,34,0.1)",
                                    color: c.source === "online" ? "var(--v-info)" : "var(--v-orange)",
                                }}>
                                {c.source}
                            </span>
                        </td>
                    </tr>
                );
            })}
        </CustomerTable>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual tab (has its own form — keeps local state)
// ─────────────────────────────────────────────────────────────────────────────

function ManualTab({
    data, user, venueId, onCustomerAdded,
}: {
    data: CRMData;
    user: User;
    venueId: string;
    onCustomerAdded: (c: ManualCustomer) => void;
}) {
    const [form, setForm]               = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting]   = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});

    function validate(f: FormState): Partial<FormState> {
        const e: Partial<FormState> = {};
        if (!f.name.trim())               e.name  = "Name is required";
        if (!f.email.trim())              e.email = "Email is required";
        else if (!EMAIL_RE.test(f.email)) e.email = "Enter a valid email";
        if (!f.phone.trim())              e.phone = "Phone number is required";
        if (!f.dob.trim())                e.dob   = "Date of birth is required";
        return e;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const errs = validate(form);
        if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
        setFieldErrors({});
        setSubmitError(null);
        setSubmitting(true);
        try {
            const res = await authFetch(user, `/api/venue/crm/customers?venueId=${encodeURIComponent(venueId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error ?? "Failed to add customer");
            onCustomerAdded(d.customer);
            setForm(EMPTY_FORM);
        } catch (err: any) {
            setSubmitError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    function handleChange(field: keyof FormState, value: string) {
        setForm((p) => ({ ...p, [field]: value }));
        if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: undefined }));
        if (submitError) setSubmitError(null);
    }

    const rows = useMemo(() => data.manual.map((c) => ({ ...c, age: calculateAge(c.dob) })), [data.manual]);

    return (
        <div className="space-y-6">
            {/* Form */}
            <div className="rounded-2xl p-6"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)", boxShadow: "var(--v-shadow-card)" }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--v-elevated)" }}>
                        <UserPlus size={15} style={{ color: "var(--v-text-secondary)" }} />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>Add Customer</p>
                        <p className="text-[11px]" style={{ color: "var(--v-text-tertiary)" }}>Manually register a guest to your venue's CRM</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Full Name" required error={fieldErrors.name}>
                            <input type="text" placeholder="e.g. Arjun Mehta" value={form.name}
                                onChange={(e) => handleChange("name", e.target.value)} style={inputStyle(!!fieldErrors.name)} />
                        </FormField>
                        <FormField label="Email Address" required error={fieldErrors.email}>
                            <input type="email" placeholder="e.g. arjun@email.com" value={form.email}
                                onChange={(e) => handleChange("email", e.target.value)} style={inputStyle(!!fieldErrors.email)} />
                        </FormField>
                        <FormField label="Phone Number" required error={fieldErrors.phone}>
                            <input type="tel" placeholder="e.g. +91 98765 43210" value={form.phone}
                                onChange={(e) => handleChange("phone", e.target.value)} style={inputStyle(!!fieldErrors.phone)} />
                        </FormField>
                        <FormField label="Date of Birth" required error={fieldErrors.dob}>
                            <input type="date" value={form.dob} max={new Date().toISOString().split("T")[0]}
                                onChange={(e) => handleChange("dob", e.target.value)} style={inputStyle(!!fieldErrors.dob)} />
                        </FormField>
                        <FormField label="Event Appeared" className="sm:col-span-2">
                            <input type="text" placeholder="e.g. Neon Nights Vol.3  (optional)" value={form.eventAppeared}
                                onChange={(e) => handleChange("eventAppeared", e.target.value)} style={inputStyle(false)} />
                        </FormField>
                    </div>

                    {submitError && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-[13px]"
                            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--v-error)" }}>
                            <AlertCircle size={14} />{submitError}
                        </div>
                    )}

                    <div className="flex justify-end mt-5">
                        <button type="submit" disabled={submitting}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ background: "var(--v-orange)", color: "#fff" }}
                            onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}>
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                            {submitting ? "Adding…" : "Add Customer"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Table */}
            {data.error ? <ErrorBanner message={data.error} /> : (
                <CustomerTable headers={["Name", "Email", "Phone", "Date of Birth", "Age", "Event Appeared"]}
                    count={rows.length} loading={data.loading} icon={LayoutList} label="Manually Added Customers"
                    emptyMessage="No customers added yet — use the form above">
                    {rows.map((c) => (
                        <tr key={c.id} {...rowProps}>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Avatar name={c.name} />
                                    <span className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{c.name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.email || "—"}</td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.phone || "—"}</td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{fmtDate(c.dob)}</td>
                            <td className="px-4 py-3"><AgeBadge age={c.age} /></td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: "var(--v-text-secondary)" }}>{c.eventAppeared || "—"}</td>
                        </tr>
                    ))}
                </CustomerTable>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form helpers
// ─────────────────────────────────────────────────────────────────────────────

function inputStyle(err: boolean): React.CSSProperties {
    return {
        width: "100%", background: "var(--v-elevated)",
        border: `1px solid ${err ? "var(--v-error)" : "var(--v-border)"}`,
        borderRadius: 12, padding: "10px 14px", fontSize: 13,
        color: "var(--v-text-primary)", outline: "none", transition: "border-color 150ms ease",
    };
}

function FormField({ label, required, error, className, children }: {
    label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode;
}) {
    return (
        <div className={className}>
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: error ? "var(--v-error)" : "var(--v-text-tertiary)" }}>
                {label}{required && <span style={{ color: "var(--v-error)" }}> *</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-[11px]" style={{ color: "var(--v-error)" }}>{error}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats strip — reads from already-fetched data, no extra requests
// ─────────────────────────────────────────────────────────────────────────────

function StatsStrip({ data }: { data: CRMData }) {
    const total = data.online.length + data.manual.length;
    const stats = [
        { label: "Total Customers",  value: data.loading ? null : total              },
        { label: "Online Purchases", value: data.loading ? null : data.online.length },
        { label: "Manual Entries",   value: data.loading ? null : data.manual.length },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {stats.map(({ label, value }) => (
                <div key={label} className="p-4 rounded-xl"
                    style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--v-text-tertiary)" }}>
                        {label}
                    </div>
                    <div className="text-2xl font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                        {value === null
                            ? <span className="inline-block w-8 h-6 rounded-md animate-pulse" style={{ background: "var(--v-elevated)" }} />
                            : value}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM Page — fetches once, shares data with all children
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { id: CRMTab; label: string; icon: React.ElementType }[] = [
    { id: "online", label: "Online", icon: Wifi     },
    { id: "total",  label: "Total",  icon: Users    },
    { id: "manual", label: "Manual", icon: UserPlus },
];

export default function CRMPage() {
    const [activeTab, setActiveTab] = useState<CRMTab>("online");
    const { user, profile } = useDashboardAuth();
    const venueId: string = profile?.activeMembership?.partnerId ?? "";

    // ── Single shared data state ─────────────────────────────────────────────
    const [crmData, setCrmData] = useState<CRMData>({
        online: [], manual: [], loading: true, error: null,
    });

    // ── Fetch both datasets in parallel, once, on mount ──────────────────────
    useEffect(() => {
        if (!user || !venueId) return;
        let cancelled = false;

        setCrmData({ online: [], manual: [], loading: true, error: null });

        const base = `?venueId=${encodeURIComponent(venueId)}`;
        Promise.all([
            authFetch(user, `/api/venue/crm/online${base}`).then((r) => r.json()),
            authFetch(user, `/api/venue/crm/customers${base}`).then((r) => r.json()),
        ])
            .then(([onlineData, manualData]) => {
                if (cancelled) return;
                if (onlineData.error) throw new Error(onlineData.error);
                if (manualData.error) throw new Error(manualData.error);
                setCrmData({
                    online:  onlineData.customers  ?? [],
                    manual:  manualData.customers  ?? [],
                    loading: false,
                    error:   null,
                });
            })
            .catch((err) => {
                if (!cancelled) setCrmData({ online: [], manual: [], loading: false, error: err.message });
            });

        return () => { cancelled = true; };
    }, [user, venueId]);

    // ── Optimistic insert after manual add ───────────────────────────────────
    const handleCustomerAdded = useCallback((c: ManualCustomer) => {
        setCrmData((prev) => ({ ...prev, manual: [c, ...prev.manual] }));
    }, []);

    // ── Wait for Firebase auth ───────────────────────────────────────────────
    if (!user) {
        return (
            <VenuePageShell title="CRM" subtitle="Customer relationship management">
                <div className="flex items-center justify-center py-32">
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--v-text-tertiary)" }} />
                </div>
            </VenuePageShell>
        );
    }

    return (
        <VenuePageShell
            title="CRM"
            subtitle="Customer relationship management — track every guest across online and walk-in channels."
        >
            {/* Tab switcher */}
            <div className="flex items-center gap-1 p-1 rounded-2xl w-fit mb-6"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)", boxShadow: "var(--v-shadow-card)" }}>
                {TABS.map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    return (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all duration-200"
                            style={{
                                background: active ? "var(--v-elevated)" : "transparent",
                                color: active ? "var(--v-text-primary)" : "var(--v-text-tertiary)",
                                border: active ? "1px solid var(--v-border)" : "1px solid transparent",
                                boxShadow: active ? "0 0 16px rgba(244,74,34,0.08)" : "none",
                            }}>
                            <Icon size={13} />
                            {label}
                            {active && <ChevronRight size={11} style={{ color: "var(--v-orange)" }} />}
                        </button>
                    );
                })}
            </div>

            {/* Stats (shared data — no extra fetch) */}
            {activeTab !== "manual" && <StatsStrip data={crmData} />}

            {/* Guard */}
            {!venueId ? (
                <ErrorBanner message="Venue ID not found. Please reload or re-login." />
            ) : (
                <>
                    {activeTab === "online" && <OnlineTab data={crmData} />}
                    {activeTab === "total"  && <TotalTab  data={crmData} />}
                    {activeTab === "manual" && (
                        <ManualTab data={crmData} user={user} venueId={venueId} onCustomerAdded={handleCustomerAdded} />
                    )}
                </>
            )}
        </VenuePageShell>
    );
}
