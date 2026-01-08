"use client";

import { useState } from "react";
import { X, Calendar, AlertCircle } from "lucide-react";

interface BlockDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    onBlock: (data: {
        date: Date;
        reason: string;
        notes?: string;
    }) => Promise<void>;
}

const BLOCK_REASONS = [
    "Renovation/Maintenance",
    "Staff Rest Day",
    "Private Event (Not Open)",
    "License Inspection",
    "Owner Discretion",
    "Other"
];

export function BlockDateModal({ isOpen, onClose, selectedDate, onBlock }: BlockDateModalProps) {
    const [reason, setReason] = useState(BLOCK_REASONS[0]);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDate) {
            setError("No date selected");
            return;
        }

        setError("");
        setLoading(true);

        try {
            await onBlock({
                date: selectedDate,
                reason,
                notes: notes.trim() || undefined,
            });

            // Reset form
            setReason(BLOCK_REASONS[0]);
            setNotes("");
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to block date");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="border-b border-slate-200 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Block Date</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Mark this date as unavailable for events
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Selected Date Display */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-slate-400" />
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected Date</p>
                                <p className="text-lg font-bold text-slate-900 mt-1">
                                    {selectedDate?.toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Reason for Blocking *
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            {BLOCK_REASONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Additional Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                            placeholder="Add any internal notes about this blocked date..."
                        />
                    </div>

                    {/* Warning */}
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs text-amber-800 font-medium">
                            ⚠️ This date will be marked as unavailable. Any pending host requests for this date will be automatically rejected.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Blocking..." : "Block Date"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
