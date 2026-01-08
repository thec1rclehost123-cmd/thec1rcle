"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Search,
    Filter,
    Building2,
    Users,
    Zap,
    Clock,
    CheckCircle,
    XCircle,
    RotateCcw,
    ChevronRight,
    MapPin,
    Mail,
    Phone,
    ShieldCheck,
    Briefcase,
    AlertCircle,
    Instagram,
    Activity
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminApprovals() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("all");

    const fetchRequests = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=onboarding_requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            // Sort by most recent using ISO strings
            const sorted = (json.data || []).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
            setRequests(sorted);
        } catch (err) {
            console.error("Failed to fetch requests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchRequests();
    }, [user]);

    const handleAction = async (reason, targetId, inputValue, evidence) => {
        if (!modalConfig) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: modalConfig.action,
                    targetId: selectedReq.id,
                    reason,
                    evidence,
                    params: {
                        type: 'onboarding_request'
                    }
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Action failed");

            await fetchRequests();
            setSelectedReq(null);
            setModalConfig(null);
        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    const filtered = requests.filter(r => {
        const matchesSearch = (
            r.data?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.data?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesFilter = filter === "all" || r.type === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Clock className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Onboarding Pipeline</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Entity Approvals</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Centrally manage onboarding requests for Venues, Hosts, and Promoters. <span className="text-slate-900">Verify credentials and provision platform access.</span>
                    </p>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="flex flex-wrap gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm items-center">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by entity name, email or reference..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                    />
                </div>
                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-[1.8rem]">
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
                    <FilterButton active={filter === 'venue'} onClick={() => setFilter('venue')} label="Venues" icon={Building2} />
                    <FilterButton active={filter === 'host'} onClick={() => setFilter('host')} label="Hosts" icon={Users} />
                    <FilterButton active={filter === 'promoter'} onClick={() => setFilter('promoter')} label="Promoters" icon={Zap} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div className="lg:col-span-3 space-y-8">
                    <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Entity Profile</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Type</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Submitted</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                    <th className="px-10 py-6"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-10 py-10"><div className="h-4 bg-slate-50 rounded-full w-full"></div></td>
                                        </tr>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-10 py-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No onboarding requests found in the current registry.</td>
                                    </tr>
                                ) : filtered.map((r) => (
                                    <tr
                                        key={r.id}
                                        onClick={() => setSelectedReq(r)}
                                        className={`group cursor-pointer transition-all ${selectedReq?.id === r.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${r.type === 'venue' ? 'bg-slate-900' : r.type === 'host' ? 'bg-indigo-600' : 'bg-emerald-600'
                                                    }`}>
                                                    {r.data?.name?.[0] || 'E'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{r.data?.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold tracking-tight">{r.data?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{r.type}</span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-xs font-bold text-slate-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'N/A'}</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <StatusBadge status={r.status} />
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-all" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="lg:col-span-1">
                    {selectedReq ? (
                        <div className="sticky top-24 p-12 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-12 animate-in fade-in slide-in-from-right-8">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request Details</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${selectedReq.type === 'venue' ? 'bg-slate-100 text-slate-900' : 'bg-indigo-50 text-indigo-600'
                                        }`}>
                                        {selectedReq.type === 'venue' ? `${selectedReq.data?.plan} Tier` : selectedReq.type}
                                    </span>
                                </div>
                                <h3 className="text-3xl font-black tracking-tighter text-slate-900">{selectedReq.data?.name}</h3>
                                <div className="space-y-4 pt-6">
                                    <DetailItem icon={MapPin} label="Location" value={`${selectedReq.data?.area}, ${selectedReq.data?.city}`} />
                                    <DetailItem icon={Briefcase} label="Contact Person" value={selectedReq.data?.contactPerson} />
                                    <DetailItem icon={Phone} label="Contact Details" value={selectedReq.data?.phone} />
                                    {selectedReq.data?.instagram && <DetailItem icon={Instagram} label="Instagram" value={selectedReq.data?.instagram} />}
                                    {selectedReq.data?.bio && <DetailItem icon={Activity} label="Biography" value={selectedReq.data?.bio} />}
                                    {selectedReq.data?.capacity && <DetailItem icon={Users} label="Capacity" value={selectedReq.data?.capacity} />}
                                    {selectedReq.data?.role && <DetailItem icon={Zap} label="Role" value={selectedReq.data?.role} />}
                                </div>
                            </div>

                            {selectedReq.status === 'pending' || selectedReq.status === 'changes_requested' ? (
                                <div className="space-y-4 pt-10 border-t border-slate-100">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-6">Administrative Actions</p>

                                    <div className="grid grid-cols-2 gap-3 mt-8">
                                        {/* Setup Controls (Before Approval) */}
                                        {selectedReq.status === 'pending' && (
                                            <div className="col-span-2 space-y-4 mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Configure Provisioning</h4>

                                                {selectedReq.type === 'venue' && (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Assigned Subscription Plan</label>
                                                        <select
                                                            value={selectedReq.data?.plan}
                                                            onChange={(e) => {
                                                                const newReqs = requests.map(r =>
                                                                    r.id === selectedReq.id ? { ...r, data: { ...r.data, plan: e.target.value } } : r
                                                                );
                                                                setRequests(newReqs);
                                                                setSelectedReq({ ...selectedReq, data: { ...selectedReq.data, plan: e.target.value } });
                                                            }}
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                                        >
                                                            <option value="basic">Basic Tier</option>
                                                            <option value="silver">Silver Tier</option>
                                                            <option value="gold">Gold Tier</option>
                                                            <option value="diamond">Diamond Tier</option>
                                                        </select>
                                                    </div>
                                                )}

                                                {selectedReq.type === 'host' && (
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-bold text-slate-500">Verification Badge</label>
                                                        <button
                                                            onClick={() => {
                                                                const newReqs = requests.map(r =>
                                                                    r.id === selectedReq.id ? { ...r, data: { ...r.data, isVerified: !r.data?.isVerified } } : r
                                                                );
                                                                setRequests(newReqs);
                                                                setSelectedReq({ ...selectedReq, data: { ...selectedReq.data, isVerified: !selectedReq.data?.isVerified } });
                                                            }}
                                                            className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${selectedReq.data?.isVerified !== false
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                : 'bg-slate-100 text-slate-400 border-slate-200'
                                                                }`}
                                                        >
                                                            {selectedReq.data?.isVerified !== false ? 'Verified' : 'Unverified'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'ONBOARDING_APPROVE',
                                                title: 'Approve & Provision',
                                                message: `This will create a ${selectedReq.type} profile and issue dashboard access to ${selectedReq.data?.email}. Plan: ${selectedReq.data?.plan || 'Standard'}.`,
                                                label: 'Execute Approval',
                                                type: 'info'
                                            })}
                                            className="col-span-2 bg-emerald-600 text-white h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                                        >
                                            Approve Enrollment
                                        </button>
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'ONBOARDING_REQUEST_CHANGES',
                                                title: 'Request Modifications',
                                                message: 'Provide clear instructions on what needs to be updated in the application.',
                                                label: 'Send Request',
                                                type: 'warning',
                                                inputLabel: 'Instruction Message',
                                                inputPlaceholder: 'e.g. Please upload a valid GST certificate...'
                                            })}
                                            className="bg-slate-900 text-white h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all"
                                        >
                                            Request Changes
                                        </button>
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'ONBOARDING_REJECT',
                                                title: 'Reject Application',
                                                message: 'This will permanently decline this onboard attempt. This action is logged.',
                                                label: 'Confirm Rejection',
                                                type: 'danger',
                                                inputLabel: 'Rejection Reason',
                                                inputPlaceholder: 'e.g. Venue does not meet our safety standards.'
                                            })}
                                            className="bg-rose-50 text-rose-600 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-rose-100 transition-all"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="pt-10 border-t border-slate-100">
                                    <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 text-center">
                                        <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Enrollment Cycle Closed</p>
                                        <p className="text-xs font-bold text-slate-900 mt-2">Actioned by System Admin</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <Clock className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a request<br />from the pipeline<br />to begin review.</p>
                        </div>
                    )}
                </aside>
            </div>

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={handleAction}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type={modalConfig.type}
                    inputLabel={modalConfig.inputLabel}
                    inputPlaceholder={modalConfig.inputPlaceholder}
                />
            )}
        </div>
    );
}

function FilterButton({ active, onClick, label, icon: Icon }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
                }`}
        >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
        </button>
    );
}

function StatusBadge({ status }) {
    const configs = {
        pending: 'bg-amber-50 border-amber-100 text-amber-600',
        approved: 'bg-emerald-50 border-emerald-100 text-emerald-600',
        rejected: 'bg-red-50 border-red-100 text-red-600',
        changes_requested: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    };
    return (
        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${configs[status] || 'bg-slate-50 border-slate-100 text-slate-400'}`}>
            {status.replace('_', ' ')}
        </span>
    );
}

function DetailItem({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all">
            <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                <p className="text-sm font-bold text-slate-900">{value || 'N/A'}</p>
            </div>
        </div>
    );
}
