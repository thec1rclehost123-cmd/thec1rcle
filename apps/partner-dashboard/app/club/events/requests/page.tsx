"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Check,
    X,
    MessageSquare,
    ChevronRight,
    AlertCircle,
    Ticket,
    Users,
    Eye
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";

interface SlotRequest {
    id: string;
    eventId: string;
    hostId: string;
    hostName: string;
    requestedDate: string;
    requestedStartTime: string;
    requestedEndTime: string;
    status: "pending" | "approved" | "rejected" | "modified";
    notes?: string;
    createdAt: string;
}

interface EventRequest {
    id: string;
    title: string;
    hostName: string;
    hostId: string;
    lifecycle: string;
    startDate: string;
    startTime: string;
    endTime: string;
    category: string;
    capacity: number;
    tickets: any[];
    image?: string;
    createdAt: string;
    slotRequest?: SlotRequest;
}

export default function ClubEventRequestsPage() {
    const { profile } = useDashboardAuth();
    const [requests, setRequests] = useState<EventRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
    const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(null);
    const [actionModal, setActionModal] = useState<{
        type: "approve" | "reject" | "changes" | null;
        request: EventRequest | null;
    }>({ type: null, request: null });
    const [actionNotes, setActionNotes] = useState("");
    const [processing, setProcessing] = useState(false);

    const clubId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (clubId) {
            fetchRequests();
        }
    }, [clubId, activeTab]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // Fetch slot requests for this club
            const slotsRes = await fetch(`/api/slots?clubId=${clubId}&status=${activeTab === "pending" ? "pending" : ""}`);
            const slotsData = await slotsRes.json();

            // For each slot request, get the event details
            const eventsWithSlots: EventRequest[] = await Promise.all(
                (slotsData.requests || []).map(async (slot: SlotRequest) => {
                    try {
                        const eventRes = await fetch(`/api/events/${slot.eventId}`);
                        const eventData = await eventRes.json();
                        return {
                            ...eventData.event,
                            slotRequest: slot
                        };
                    } catch {
                        return null;
                    }
                })
            );

            setRequests(eventsWithSlots.filter(Boolean));
        } catch (err) {
            console.error("Failed to fetch requests:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: "approve" | "reject" | "suggest") => {
        if (!actionModal.request) return;

        setProcessing(true);
        try {
            const slotId = actionModal.request.slotRequest?.id;
            if (!slotId) throw new Error("No slot request found");

            const res = await fetch(`/api/slots/${slotId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    notes: actionNotes,
                    actor: {
                        uid: profile?.uid,
                        role: "club",
                        name: profile?.displayName
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Action failed");
            }

            // If approved, also update event lifecycle
            if (action === "approve") {
                await fetch(`/api/events/${actionModal.request.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "approve",
                        notes: actionNotes,
                        actor: {
                            uid: profile?.uid,
                            role: "club",
                            name: profile?.displayName
                        }
                    })
                });
            }

            // Refresh list
            fetchRequests();
            setActionModal({ type: null, request: null });
            setActionNotes("");
        } catch (err: any) {
            alert(err.message || "Action failed");
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: "bg-[#ff9500]/10 text-[#ff9500]",
            approved: "bg-[#34c759]/10 text-[#34c759]",
            rejected: "bg-[#ff3b30]/10 text-[#ff3b30]",
            modified: "bg-[#007aff]/10 text-[#007aff]"
        };
        return styles[status] || "bg-[#f5f5f7] text-[#86868b]";
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-headline">Event Requests</h1>
                    <p className="text-body-sm text-[#86868b] mt-1">
                        Review and approve event requests from partner hosts
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 bg-[#f5f5f7] rounded-xl w-fit">
                {[
                    { id: "pending", label: "Pending" },
                    { id: "all", label: "All Requests" }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === tab.id
                                ? "bg-white text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:text-[#1d1d1f]"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card p-6 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-xl bg-[#f5f5f7]" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-48 bg-[#f5f5f7] rounded" />
                                    <div className="h-4 w-32 bg-[#f5f5f7] rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-[#86868b]" />
                    </div>
                    <h3 className="text-headline-sm mb-2">No {activeTab === "pending" ? "Pending" : ""} Requests</h3>
                    <p className="text-body-sm text-[#86868b]">
                        {activeTab === "pending"
                            ? "All event requests have been reviewed."
                            : "No hosts have requested event slots yet."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(request => (
                        <motion.div
                            key={request.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card p-6"
                        >
                            <div className="flex items-start gap-4">
                                {/* Event Image */}
                                <div className="w-24 h-24 rounded-xl bg-[#f5f5f7] overflow-hidden flex-shrink-0">
                                    {request.image ? (
                                        <img
                                            src={request.image}
                                            alt={request.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Calendar className="w-8 h-8 text-[#86868b]" />
                                        </div>
                                    )}
                                </div>

                                {/* Event Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="text-headline-sm">{request.title}</h3>
                                            <p className="text-caption flex items-center gap-2">
                                                <User className="w-3.5 h-3.5" />
                                                by {request.hostName}
                                            </p>
                                        </div>
                                        <span className={`badge ${getStatusBadge(request.slotRequest?.status || "pending")}`}>
                                            {request.slotRequest?.status || "pending"}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mt-4">
                                        <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                                            <Calendar className="w-4 h-4" />
                                            {request.slotRequest?.requestedDate
                                                ? new Date(request.slotRequest.requestedDate).toLocaleDateString("en-IN", {
                                                    weekday: "short",
                                                    day: "numeric",
                                                    month: "short"
                                                })
                                                : "No date"}
                                        </div>
                                        <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                                            <Clock className="w-4 h-4" />
                                            {request.slotRequest?.requestedStartTime || request.startTime} - {request.slotRequest?.requestedEndTime || request.endTime}
                                        </div>
                                        <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                                            <Users className="w-4 h-4" />
                                            {request.capacity} capacity
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {request.slotRequest?.notes && (
                                        <div className="mt-3 p-3 rounded-lg bg-[#f5f5f7]">
                                            <p className="text-[13px] text-[#6e6e73]">
                                                <strong>Host Note:</strong> {request.slotRequest.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {request.slotRequest?.status === "pending" && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => setActionModal({ type: "approve", request })}
                                            className="btn btn-primary px-4 py-2 text-[13px]"
                                        >
                                            <Check className="w-4 h-4" /> Approve
                                        </button>
                                        <button
                                            onClick={() => setActionModal({ type: "reject", request })}
                                            className="btn btn-ghost px-4 py-2 text-[13px] text-[#ff3b30]"
                                        >
                                            <X className="w-4 h-4" /> Reject
                                        </button>
                                        <button
                                            onClick={() => setActionModal({ type: "changes", request })}
                                            className="btn btn-ghost px-4 py-2 text-[13px]"
                                        >
                                            <MessageSquare className="w-4 h-4" /> Suggest
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Action Modal */}
            <AnimatePresence>
                {actionModal.type && actionModal.request && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                        onClick={() => setActionModal({ type: null, request: null })}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-title mb-2">
                                {actionModal.type === "approve" && "Approve Event"}
                                {actionModal.type === "reject" && "Reject Event"}
                                {actionModal.type === "changes" && "Request Changes"}
                            </h3>
                            <p className="text-body-sm text-[#86868b] mb-6">
                                {actionModal.type === "approve" && "This will confirm the slot and approve the event for publication."}
                                {actionModal.type === "reject" && "The host will be notified of the rejection and can request a different date."}
                                {actionModal.type === "changes" && "Suggest alternative dates or request modifications."}
                            </p>

                            <div className="p-4 rounded-xl bg-[#f5f5f7] mb-4">
                                <p className="text-[15px] font-semibold text-[#1d1d1f]">{actionModal.request.title}</p>
                                <p className="text-[13px] text-[#86868b]">
                                    {actionModal.request.slotRequest?.requestedDate} • {actionModal.request.slotRequest?.requestedStartTime}
                                </p>
                            </div>

                            <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder={
                                    actionModal.type === "approve"
                                        ? "Add a note (optional)..."
                                        : "Provide a reason or suggestion..."
                                }
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] resize-none focus:outline-none focus:border-[#007aff] focus:bg-white transition-all mb-4"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setActionModal({ type: null, request: null })}
                                    className="flex-1 btn btn-secondary"
                                    disabled={processing}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAction(
                                        actionModal.type === "changes" ? "suggest" : actionModal.type!
                                    )}
                                    disabled={processing || (actionModal.type !== "approve" && !actionNotes.trim())}
                                    className={`flex-1 btn ${actionModal.type === "approve"
                                            ? "btn-primary"
                                            : actionModal.type === "reject"
                                                ? "bg-[#ff3b30] text-white hover:bg-[#ff3b30]/90"
                                                : "btn-primary"
                                        }`}
                                >
                                    {processing ? "Processing..." : (
                                        actionModal.type === "approve" ? "Approve" :
                                            actionModal.type === "reject" ? "Reject" : "Send"
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
