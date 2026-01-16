"use client";

import { useState } from "react";
import { X, Shield, Mail, User, ChevronRight, RefreshCcw } from "lucide-react";

export default function ProvisionAdminModal({ isOpen, onClose, onProvision }) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("support");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onProvision({ email, name, role });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">Add New Admin</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                Set Permissions
                                <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                User Profile
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200">
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-12 space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Staff Member Name</label>
                        <div className="relative group">
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-bold focus:bg-white focus:border-slate-400 transition-all outline-none"
                                placeholder="Name"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Work Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-bold focus:bg-white focus:border-slate-400 transition-all outline-none"
                                placeholder="colleague@thecircle.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned Role</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['support', 'ops', 'finance', 'content'].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${role === r
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-5 rounded-[1.8rem] bg-slate-50 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[1.5] px-8 py-5 rounded-[1.8rem] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <RefreshCcw className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    Add Admin
                                    <ChevronRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="p-8 bg-slate-900 flex items-center gap-6">
                    <Shield className="h-8 w-8 text-indigo-400 opacity-50" />
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                        Security Notice: Adding an admin account grants full access. This action will be logged in the system activity log.
                    </p>
                </div>
            </div>
        </div>
    );
}
