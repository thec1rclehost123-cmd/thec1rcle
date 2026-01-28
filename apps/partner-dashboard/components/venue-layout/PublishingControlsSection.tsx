"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    FileCheck,
    FileClock,
    Eye,
    Globe,
    Shield,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    History,
    RefreshCcw
} from "lucide-react";

interface PublishingControlsSectionProps {
    venue: any;
    onUpdate: (updates: any) => Promise<void>;
    onPublish: () => Promise<void>;
    isPublishing?: boolean;
}

export default function PublishingControlsSection({ venue, onUpdate, onPublish, isPublishing }: PublishingControlsSectionProps) {
    const [showVersionHistory, setShowVersionHistory] = useState(false);

    const publishStatus = venue?.publishStatus || "published";
    const lastPublished = venue?.lastPublishedAt ? new Date(venue.lastPublishedAt) : null;
    const lastModified = venue?.updatedAt ? new Date(venue.updatedAt) : null;
    const hasUnpublishedChanges = lastModified && lastPublished && lastModified > lastPublished;

    // Mock version history
    const versionHistory = [
        { id: 1, date: "2024-01-28T10:30:00", action: "Published", user: "Admin", changes: ["Updated bio", "Added 3 photos"] },
        { id: 2, date: "2024-01-25T15:45:00", action: "Published", user: "Admin", changes: ["Changed cover image"] },
        { id: 3, date: "2024-01-20T09:00:00", action: "Published", user: "Admin", changes: ["Initial setup"] },
    ];

    // Content validation checks
    const validationChecks = [
        { id: "name", label: "Venue name added", passed: !!venue?.displayName || !!venue?.name },
        { id: "bio", label: "Description added", passed: !!venue?.bio },
        { id: "cover", label: "Cover image uploaded", passed: !!venue?.coverURL },
        { id: "photo", label: "Profile photo uploaded", passed: !!venue?.photoURL },
        { id: "contact", label: "Contact info complete", passed: !!venue?.phone || !!venue?.email },
        { id: "location", label: "Location set", passed: !!venue?.city || !!venue?.address },
    ];

    const passedChecks = validationChecks.filter(check => check.passed).length;
    const allChecksPassed = passedChecks === validationChecks.length;

    return (
        <div className="space-y-8">
            {/* Status Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl ${publishStatus === "published"
                        ? "bg-emerald-500/10"
                        : publishStatus === "draft"
                            ? "bg-amber-500/10"
                            : "bg-red-500/10"
                        }`}>
                        {publishStatus === "published" ? (
                            <Globe className="w-5 h-5 text-emerald-500" />
                        ) : publishStatus === "draft" ? (
                            <FileClock className="w-5 h-5 text-amber-500" />
                        ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Publishing Status</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">Control your venue page visibility</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowVersionHistory(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-[11px] font-bold border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all"
                    >
                        <History className="w-4 h-4" />
                        History
                    </button>
                </div>
            </div>

            {/* Current Status Card */}
            <div className={`p-8 rounded-3xl border-2 ${publishStatus === "published"
                ? "bg-emerald-500/5 border-emerald-500/20"
                : publishStatus === "draft"
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-red-500/5 border-red-500/20"
                }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${publishStatus === "published"
                                ? "bg-emerald-500/20 text-emerald-600"
                                : publishStatus === "draft"
                                    ? "bg-amber-500/20 text-amber-600"
                                    : "bg-red-500/20 text-red-600"
                                }`}>
                                {publishStatus === "published" ? "Live" : publishStatus === "draft" ? "Draft" : "Unpublished"}
                            </span>
                            {hasUnpublishedChanges && publishStatus === "published" && (
                                <span className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 rounded-full text-[10px] font-bold text-amber-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    Unpublished Changes
                                </span>
                            )}
                        </div>
                        <h4 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                            {publishStatus === "published"
                                ? "Your venue page is live"
                                : publishStatus === "draft"
                                    ? "Your changes are saved as draft"
                                    : "Your venue page is hidden"}
                        </h4>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            {lastPublished
                                ? `Last published ${lastPublished.toLocaleDateString()} at ${lastPublished.toLocaleTimeString()}`
                                : "Never published"}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {publishStatus === "published" ? (
                            <>
                                <button
                                    onClick={() => onUpdate({ publishStatus: "draft" })}
                                    className="px-6 py-3 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-[11px] font-bold border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all"
                                >
                                    Unpublish
                                </button>
                                {hasUnpublishedChanges && (
                                    <button
                                        onClick={onPublish}
                                        disabled={isPublishing}
                                        className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                                    >
                                        {isPublishing ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RefreshCcw className="w-4 h-4" />
                                        )}
                                        Publish Changes
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={onPublish}
                                disabled={isPublishing || !allChecksPassed}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                            >
                                {isPublishing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Globe className="w-4 h-4" />
                                )}
                                Publish Now
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Validation */}
            <div className="p-6 bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-[var(--text-tertiary)]" />
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">Content Checklist</h4>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${allChecksPassed
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500"
                        }`}>
                        {passedChecks}/{validationChecks.length} Complete
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {validationChecks.map((check) => (
                        <div
                            key={check.id}
                            className={`flex items-center gap-3 p-3 rounded-xl ${check.passed
                                ? "bg-emerald-500/5"
                                : "bg-amber-500/5"
                                }`}
                        >
                            {check.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <XCircle className="w-4 h-4 text-amber-500" />
                            )}
                            <span className={`text-sm ${check.passed
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)]"
                                }`}>
                                {check.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Moderation Status */}
            <div className="p-6 bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 mb-4">
                    <FileCheck className="w-5 h-5 text-[var(--text-tertiary)]" />
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">Content Moderation</h4>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm text-[var(--text-secondary)]">All content approved</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                        Last reviewed: {new Date().toLocaleDateString()}
                    </span>
                </div>
            </div>

            {/* Version History Modal */}
            <AnimatePresence>
                {showVersionHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowVersionHistory(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg bg-[var(--surface-primary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-[var(--border-subtle)]">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Version History</h2>
                                <p className="text-sm text-[var(--text-tertiary)]">Previous versions of your venue page</p>
                            </div>

                            <div className="max-h-96 overflow-y-auto p-6 space-y-4">
                                {versionHistory.map((version) => (
                                    <div key={version.id} className="p-4 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-subtle)]">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-1 bg-emerald-500/10 rounded-md text-[10px] font-bold text-emerald-500">
                                                {version.action}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-tertiary)]">
                                                {new Date(version.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)] mb-2">by {version.user}</p>
                                        <ul className="space-y-1">
                                            {version.changes.map((change, idx) => (
                                                <li key={idx} className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-2">
                                                    <span className="w-1 h-1 rounded-full bg-[var(--text-placeholder)]" />
                                                    {change}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-[var(--border-subtle)]">
                                <button
                                    onClick={() => setShowVersionHistory(false)}
                                    className="w-full py-3 bg-[var(--surface-secondary)] text-[var(--text-secondary)] rounded-xl text-sm font-bold hover:bg-[var(--surface-elevated)] transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
