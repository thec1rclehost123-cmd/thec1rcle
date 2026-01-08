"use client";

import { useState } from "react";
import {
    X,
    Calendar,
    Users,
    Ticket,
    DollarSign,
    MapPin,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Pause,
    Lock,
    Star,
    MessageSquare
} from "lucide-react";

interface EventDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: any;
    onUpdate: (action: string, data?: any) => Promise<void>;
}

export function EventDetailsModal({ isOpen, onClose, event, onUpdate }: EventDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<"details" | "approval" | "feedback">("details");
    const [loading, setLoading] = useState(false);
    const [approvalNotes, setApprovalNotes] = useState("");
    const [hostRating, setHostRating] = useState(0);
    const [feedbackNotes, setFeedbackNotes] = useState("");

    if (!isOpen || !event) return null;

    const handleApprove = async () => {
        setLoading(true);
        try {
            await onUpdate("approve", { notes: approvalNotes });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!confirm("Are you sure you want to reject this event?")) return;

        setLoading(true);
        try {
            await onUpdate("reject", { notes: approvalNotes });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePause = async () => {
        if (!confirm("Pause this event? Ticket sales will be stopped immediately.")) return;

        setLoading(true);
        try {
            await onUpdate("pause");
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLock = async () => {
        if (!confirm("Lock this event? Data cannot be edited after locking.")) return;

        setLoading(true);
        try {
            await onUpdate("lock", {
                rating: hostRating,
                feedback: feedbackNotes,
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const showApprovalTab = event.status === "pending";
    const showFeedbackTab = event.status === "completed";
    const canPause = event.status === "live";
    const canLock = event.status === "completed";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-start justify-between rounded-t-2xl z-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-slate-900">{event.title}</h2>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase`}>
                                {event.status}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500">
                            Hosted by <span className="font-semibold text-indigo-600">{event.hostName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 px-6">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab("details")}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "details"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Event Details
                        </button>
                        {showApprovalTab && (
                            <button
                                onClick={() => setActiveTab("approval")}
                                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "approval"
                                        ? "border-indigo-600 text-indigo-600"
                                        : "border-transparent text-slate-500 hover:text-slate-900"
                                    }`}
                            >
                                Approval
                            </button>
                        )}
                        {showFeedbackTab && (
                            <button
                                onClick={() => setActiveTab("feedback")}
                                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "feedback"
                                        ? "border-indigo-600 text-indigo-600"
                                        : "border-transparent text-slate-500 hover:text-slate-900"
                                    }`}
                            >
                                Post-Event Review
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">

                    {/* Details Tab */}
                    {activeTab === "details" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500 uppercase">Date</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">
                                        {event.date?.toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500 uppercase">Time</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">9:00 PM - 3:00 AM</p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Ticket className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500 uppercase">Tickets</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">
                                        {event.ticketsSold}/{event.ticketsTotal}
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500 uppercase">Crowd</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">{event.expectedCrowd} pax</p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500 uppercase">Promoters</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">
                                        {event.promotersEnabled ? `${event.promotersCount || 0} Active` : "Disabled"}
                                    </p>
                                </div>

                                {event.revenue && (
                                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="h-4 w-4 text-emerald-600" />
                                            <span className="text-xs font-bold text-emerald-600 uppercase">Revenue</span>
                                        </div>
                                        <p className="text-sm font-bold text-emerald-700">₹{(event.revenue / 1000).toFixed(0)}K</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs font-bold text-blue-600 uppercase mb-2">Entry Rules</p>
                                <p className="text-sm text-blue-900 font-medium">
                                    Couples Preferred • 21+ Only • Valid ID Required
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Approval Tab */}
                    {activeTab === "approval" && showApprovalTab && (
                        <div className="space-y-6">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-900 mb-1">Pending Approval</p>
                                        <p className="text-xs text-amber-700">
                                            Review event details and approve or reject this request.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Approval Notes (Optional)
                                </label>
                                <textarea
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Add internal notes about this decision..."
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleReject}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Reject Event
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Approve Event
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Feedback Tab */}
                    {activeTab === "feedback" && showFeedbackTab && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-3">
                                    Rate Host Performance
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setHostRating(star)}
                                            className="p-2 hover:scale-110 transition-transform"
                                        >
                                            <Star
                                                className={`h-8 w-8 ${star <= hostRating
                                                        ? "fill-amber-400 text-amber-400"
                                                        : "text-slate-300"
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Internal Feedback
                                </label>
                                <textarea
                                    value={feedbackNotes}
                                    onChange={(e) => setFeedbackNotes(e.target.value)}
                                    rows={5}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Crowd quality, issues, special notes..."
                                />
                            </div>

                            <button
                                onClick={handleLock}
                                disabled={loading || hostRating === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50"
                            >
                                <Lock className="h-4 w-4" />
                                Lock Event Data
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {activeTab === "details" && (
                    <div className="border-t border-slate-200 p-6 bg-slate-50 flex gap-3">
                        {canPause && (
                            <button
                                onClick={handlePause}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
                            >
                                <Pause className="h-4 w-4" />
                                Emergency Pause
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
