"use client";

import { useState, useEffect } from "react";
import {
    Plus,
    Copy,
    Trash2,
    QrCode,
    Users,
    Smartphone,
    Check,
    RefreshCw
} from "lucide-react";

interface EventCode {
    id: string;
    code: string;
    type: "full" | "scan_only";
    gate: string | null;
    isRevoked: boolean;
    createdAt: string;
    usageCount: number;
    lastUsedAt: string | null;
    stats?: {
        scansCount: number;
        doorEntriesCount: number;
        doorRevenue: number;
    };
}

interface ScannerAccessProps {
    eventId: string;
    eventTitle?: string;
}

export default function ScannerAccess({ eventId, eventTitle }: ScannerAccessProps) {
    const [codes, setCodes] = useState<EventCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // New code form
    const [newCodeType, setNewCodeType] = useState<"full" | "scan_only">("full");
    const [newCodeGate, setNewCodeGate] = useState("");

    const fetchCodes = async () => {
        try {
            const res = await fetch(`/api/event-codes?eventId=${eventId}`);
            const data = await res.json();
            setCodes(data.codes || []);
        } catch (error) {
            console.error("Failed to fetch codes:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCodes();
    }, [eventId]);

    const createCode = async () => {
        setCreating(true);
        try {
            const res = await fetch("/api/event-codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId,
                    type: newCodeType,
                    gate: newCodeGate || null,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setCodes([data.code, ...codes]);
                setShowCreateModal(false);
                setNewCodeGate("");
            }
        } catch (error) {
            console.error("Failed to create code:", error);
        }
        setCreating(false);
    };

    const revokeCode = async (codeId: string) => {
        if (!confirm("Are you sure you want to revoke this code?")) return;

        try {
            await fetch(`/api/event-codes?id=${codeId}`, { method: "DELETE" });
            setCodes(codes.map(c =>
                c.id === codeId ? { ...c, isRevoked: true } : c
            ));
        } catch (error) {
            console.error("Failed to revoke code:", error);
        }
    };

    const copyCode = async (code: string) => {
        await navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const activeCodes = codes.filter(c => !c.isRevoked);

    return (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Scanner Access</h3>
                        <p className="text-sm text-slate-400">
                            {activeCodes.length} active code{activeCodes.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchCodes}
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 
                       rounded-xl text-white font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Generate Code
                    </button>
                </div>
            </div>

            {/* Codes List */}
            {loading ? (
                <div className="text-center py-8 text-slate-400">Loading codes...</div>
            ) : codes.length === 0 ? (
                <div className="text-center py-12">
                    <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 mb-4">No scanner codes yet</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                        Generate your first code
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {codes.map((code) => (
                        <div
                            key={code.id}
                            className={`
                p-4 rounded-xl border transition-colors
                ${code.isRevoked
                                    ? "bg-slate-800/30 border-slate-700/30 opacity-50"
                                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                                }
              `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Code */}
                                    <div className="font-mono text-xl font-bold text-white">
                                        {code.code}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex items-center gap-2">
                                        <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${code.type === "full"
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-amber-500/20 text-amber-400"
                                            }
                    `}>
                                            {code.type === "full" ? "Full Access" : "Scan Only"}
                                        </span>

                                        {code.gate && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium 
                                       bg-slate-600/50 text-slate-300">
                                                {code.gate}
                                            </span>
                                        )}

                                        {code.isRevoked && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium 
                                       bg-red-500/20 text-red-400">
                                                Revoked
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                {!code.isRevoked && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyCode(code.code)}
                                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                                            title="Copy code"
                                        >
                                            {copiedCode === code.code ? (
                                                <Check className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-slate-400" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => revokeCode(code.id)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                            title="Revoke code"
                                        >
                                            <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            {code.stats && !code.isRevoked && (
                                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-700/50">
                                    <div className="flex items-center gap-2 text-sm">
                                        <QrCode className="w-4 h-4 text-slate-500" />
                                        <span className="text-slate-400">
                                            {code.stats.scansCount} scans
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="w-4 h-4 text-slate-500" />
                                        <span className="text-slate-400">
                                            {code.stats.doorEntriesCount} door entries
                                        </span>
                                    </div>
                                    <div className="text-sm text-emerald-400 font-medium">
                                        ₹{code.stats.doorRevenue.toLocaleString()} collected
                                    </div>
                                </div>
                            )}

                            {/* Usage info */}
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span>Used {code.usageCount} time{code.usageCount !== 1 ? "s" : ""}</span>
                                {code.lastUsedAt && (
                                    <span>Last: {new Date(code.lastUsedAt).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
                        <h3 className="text-xl font-semibold text-white mb-4">
                            Generate Scanner Code
                        </h3>

                        {/* Type Selection */}
                        <div className="mb-4">
                            <label className="block text-sm text-slate-400 mb-2">
                                Access Type
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setNewCodeType("full")}
                                    className={`
                    p-4 rounded-xl border-2 transition-colors text-left
                    ${newCodeType === "full"
                                            ? "border-indigo-500 bg-indigo-500/10"
                                            : "border-slate-600 hover:border-slate-500"
                                        }
                  `}
                                >
                                    <div className="font-medium text-white">Full Access</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        Scan tickets + Door entry
                                    </div>
                                </button>
                                <button
                                    onClick={() => setNewCodeType("scan_only")}
                                    className={`
                    p-4 rounded-xl border-2 transition-colors text-left
                    ${newCodeType === "scan_only"
                                            ? "border-indigo-500 bg-indigo-500/10"
                                            : "border-slate-600 hover:border-slate-500"
                                        }
                  `}
                                >
                                    <div className="font-medium text-white">Scan Only</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        Ticket scanning only
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Gate Name */}
                        <div className="mb-6">
                            <label className="block text-sm text-slate-400 mb-2">
                                Gate/Zone Name (optional)
                            </label>
                            <input
                                type="text"
                                value={newCodeGate}
                                onChange={(e) => setNewCodeGate(e.target.value)}
                                placeholder="e.g., Main Gate, VIP Entry"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 
                           rounded-xl text-white placeholder-slate-500
                           focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-3 border border-slate-600 rounded-xl 
                           text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createCode}
                                disabled={creating}
                                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 
                           rounded-xl text-white font-medium transition-colors
                           disabled:opacity-50"
                            >
                                {creating ? "Creating..." : "Generate Code"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
