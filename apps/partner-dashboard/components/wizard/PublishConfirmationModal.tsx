"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    MapPin,
    Ticket,
    Clock,
    AlertTriangle,
    CheckCircle2,
    X,
    ExternalLink,
    Loader2,
    ImageIcon,
    Users
} from "lucide-react";

interface PublishConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isSubmitting: boolean;
    formData: {
        title: string;
        startDate: string;
        startTime: string;
        endTime: string;
        venueName: string;
        city: string;
        capacity: number;
        tickets: Array<{
            id: string;
            name: string;
            price: number;
            quantity: number;
        }>;
        image?: string;
        description?: string;
        promotersEnabled?: boolean;
    };
    role: 'club' | 'host';
}

export function PublishConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    isSubmitting,
    formData,
    role
}: PublishConfirmationModalProps) {
    // Calculate warnings
    const warnings: string[] = [];

    if (!formData.image) {
        warnings.push("No event poster uploaded — events with posters get 3x more engagement");
    }

    if (!formData.description || formData.description.length < 50) {
        warnings.push("Description is too short — add more details to attract guests");
    }

    const totalTickets = formData.tickets?.reduce((sum, t) => sum + (t.quantity || 0), 0) || 0;
    const lowestPrice = formData.tickets?.length
        ? Math.min(...formData.tickets.map(t => t.price || 0))
        : 0;
    const highestPrice = formData.tickets?.length
        ? Math.max(...formData.tickets.map(t => t.price || 0))
        : 0;

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Date TBD";
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const isHostSubmission = role === 'host';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 pb-4 border-b border-[rgba(0,0,0,0.06)]">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-[#1d1d1f]">
                                        {isHostSubmission ? "Submit for Approval" : "Publish Event"}
                                    </h2>
                                    <p className="text-[13px] text-[#86868b] mt-1">
                                        {isHostSubmission
                                            ? "Your event will be sent to the venue for review"
                                            : "Your event will be live immediately"
                                        }
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="p-2 rounded-full hover:bg-black/5 transition-colors disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-[#86868b]" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                            {/* Event Summary Card */}
                            <div className="p-4 rounded-2xl bg-[#f5f5f7] space-y-3">
                                <h3 className="font-semibold text-[#1d1d1f] text-lg leading-tight">
                                    {formData.title || "Untitled Event"}
                                </h3>

                                <div className="grid grid-cols-2 gap-3 text-[13px]">
                                    <div className="flex items-center gap-2 text-[#6e6e73]">
                                        <Calendar className="w-4 h-4" />
                                        <span>{formatDate(formData.startDate)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#6e6e73]">
                                        <Clock className="w-4 h-4" />
                                        <span>{formData.startTime || "TBD"} - {formData.endTime || "TBD"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#6e6e73]">
                                        <MapPin className="w-4 h-4" />
                                        <span className="truncate">{formData.venueName || "Venue TBD"}, {formData.city}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#6e6e73]">
                                        <Users className="w-4 h-4" />
                                        <span>{formData.capacity || 0} capacity</span>
                                    </div>
                                </div>
                            </div>

                            {/* Ticket Summary */}
                            <div className="p-4 rounded-2xl border border-[rgba(0,0,0,0.06)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Ticket className="w-4 h-4 text-[#86868b]" />
                                        <span className="text-[13px] font-medium text-[#1d1d1f]">Ticket Tiers</span>
                                    </div>
                                    <span className="text-[13px] text-[#86868b]">
                                        {formData.tickets?.length || 0} tiers
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-[rgba(0,0,0,0.04)]">
                                    <div>
                                        <p className="text-[11px] text-[#86868b] uppercase tracking-wider">Price Range</p>
                                        <p className="text-[15px] font-semibold text-[#1d1d1f]">
                                            {lowestPrice === 0 && highestPrice === 0
                                                ? "Free"
                                                : lowestPrice === highestPrice
                                                    ? `₹${lowestPrice.toLocaleString()}`
                                                    : `₹${lowestPrice.toLocaleString()} - ₹${highestPrice.toLocaleString()}`
                                            }
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-[#86868b] uppercase tracking-wider">Total Tickets</p>
                                        <p className="text-[15px] font-semibold text-[#1d1d1f]">{totalTickets}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Warnings */}
                            {warnings.length > 0 && (
                                <div className="space-y-2">
                                    {warnings.map((warning, index) => (
                                        <div
                                            key={index}
                                            className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100"
                                        >
                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-[13px] text-amber-800">{warning}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Promoter Status */}
                            {formData.promotersEnabled && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <p className="text-[13px] text-emerald-800">
                                        Promoter sales enabled — promoters can generate links after publishing
                                    </p>
                                </div>
                            )}

                            {/* Host Submission Note */}
                            {isHostSubmission && (
                                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                                    <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[13px] font-medium text-blue-800">Venue Approval Required</p>
                                        <p className="text-[12px] text-blue-700 mt-1">
                                            The venue will review your event details. You'll be notified once approved.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 pt-4 border-t border-[rgba(0,0,0,0.06)] flex items-center justify-between gap-4 bg-[#fafafa]">
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-5 py-3 rounded-xl text-[14px] font-semibold text-[#1d1d1f] hover:bg-black/5 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0071e3] text-white text-[14px] font-semibold hover:bg-[#0077ED] transition-colors disabled:opacity-70 shadow-sm"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {isHostSubmission ? "Submitting..." : "Publishing..."}
                                    </>
                                ) : (
                                    <>
                                        {isHostSubmission ? "Submit for Approval" : "Publish Now"}
                                        <ExternalLink className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default PublishConfirmationModal;
