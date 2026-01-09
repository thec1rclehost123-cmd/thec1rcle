"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, User, Shield, AlertCircle, CheckCircle2, FileEdit, Send, Play } from 'lucide-react';

interface AuditEntry {
    action: string;
    timestamp: string;
    actor: {
        uid: string;
        role: string;
        name?: string;
        email?: string;
    };
    notes?: string;
    details?: any;
}

interface AuditTrailProps {
    entries: AuditEntry[];
}

const actionIcons: Record<string, any> = {
    created: { icon: Send, color: "text-blue-500", bg: "bg-blue-50" },
    updated: { icon: FileEdit, color: "text-amber-500", bg: "bg-amber-50" },
    edited: { icon: FileEdit, color: "text-amber-500", bg: "bg-amber-50" },
    PUBLISH_SUCCESS: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    transitioned_to_submitted: { icon: Send, color: "text-blue-500", bg: "bg-blue-50" },
    transitioned_to_approved: { icon: Shield, color: "text-indigo-500", bg: "bg-indigo-50" },
    transitioned_to_scheduled: { icon: Play, color: "text-emerald-500", bg: "bg-emerald-50" },
    transitioned_to_denied: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
    transitioned_to_needs_changes: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
    deleted: { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
};

export default function AuditTrail({ entries = [] }: AuditTrailProps) {
    if (!entries || entries.length === 0) {
        return (
            <div className="py-12 text-center">
                <Clock className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">No activity recorded for this event yet.</p>
            </div>
        );
    }

    // Sort entries by timestamp descending
    const sortedEntries = [...entries].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
        <div className="space-y-6">
            <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[21px] top-2 bottom-0 w-0.5 bg-slate-100" />

                <div className="space-y-8">
                    {sortedEntries.map((entry, index) => {
                        const style = actionIcons[entry.action] || { icon: Clock, color: "text-slate-400", bg: "bg-slate-50" };
                        const Icon = style.icon;

                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="relative pl-12"
                            >
                                {/* Marker */}
                                <div className={`absolute left-0 top-1 h-[44px] w-[44px] rounded-2xl ${style.bg} flex items-center justify-center border-4 border-white shadow-sm z-10`}>
                                    <Icon className={`h-5 w-5 ${style.color}`} />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                            {entry.action.replace('transitioned_to_', '').replace('_', ' ')}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {new Date(entry.timestamp).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                            <User className="h-3 w-3" />
                                            {entry.actor.role}
                                        </div>
                                        <span className="truncate max-w-[200px]">
                                            {entry.actor.name || entry.actor.email || entry.actor.uid.slice(0, 8)}
                                        </span>
                                    </div>

                                    {entry.notes && (
                                        <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                                            "{entry.notes}"
                                        </p>
                                    )}

                                    {entry.details && Object.keys(entry.details).length > 0 && (
                                        <details className="mt-2">
                                            <summary className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors">
                                                Technical Details
                                            </summary>
                                            <pre className="mt-2 text-[10px] font-mono bg-slate-900 text-slate-300 p-3 rounded-xl overflow-x-auto shadow-inner">
                                                {JSON.stringify(entry.details, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
