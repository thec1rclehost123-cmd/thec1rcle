"use client";

import { useState } from "react";
import { X, Upload, Calendar, DollarSign, Users, Percent, AlertCircle, Plus, Minus } from "lucide-react";

interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    venueId: string;
    onSubmit: (eventData: any) => Promise<void>;
}

interface TicketPhase {
    id: string;
    name: string;
    price: number;
    quantity: number;
    startDate?: string;
    endDate?: string;
}

export function CreateEventModal({ isOpen, onClose, venueId, onSubmit }: CreateEventModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Basic Info
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventDate, setEventDate] = useState("");
    const [startTime, setStartTime] = useState("21:00");
    const [endTime, setEndTime] = useState("03:00");

    // Ticketing
    const [ticketPhases, setTicketPhases] = useState<TicketPhase[]>([
        { id: "1", name: "Early Bird", price: 999, quantity: 100 },
    ]);
    const [totalCapacity, setTotalCapacity] = useState(500);

    // Entry Rules
    const [ageLimit, setAgeLimit] = useState("21");
    const [couplePolicy, setCouplePolicy] = useState("preferred");
    const [dressCode, setDressCode] = useState("");

    // Promoter Settings
    const [promotersEnabled, setPromotersEnabled] = useState(true);
    const [commissionType, setCommissionType] = useState<"percentage" | "amount">("percentage");
    const [commissionValue, setCommissionValue] = useState(10);
    const [promoterLimit, setPromoterLimit] = useState(50);

    // Revenue Sharing
    const [hostShare, setHostShare] = useState(20);
    const [clubShare, setVenueShare] = useState(80);

    const addTicketPhase = () => {
        setTicketPhases([
            ...ticketPhases,
            {
                id: Date.now().toString(),
                name: `Phase ${ticketPhases.length + 1}`,
                price: 1499,
                quantity: 100,
            },
        ]);
    };

    const removeTicketPhase = (id: string) => {
        if (ticketPhases.length > 1) {
            setTicketPhases(ticketPhases.filter((p) => p.id !== id));
        }
    };

    const updateTicketPhase = (id: string, field: string, value: any) => {
        setTicketPhases(
            ticketPhases.map((p) => (p.id === id ? { ...p, [field]: value } : p))
        );
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const eventData = {
                title,
                description,
                date: new Date(eventDate),
                startTime,
                endTime,
                venueId: venueId,
                status: "draft",
                ticketing: {
                    phases: ticketPhases,
                    totalCapacity,
                },
                entryRules: {
                    ageLimit: parseInt(ageLimit),
                    couplePolicy,
                    dressCode,
                },
                promoters: {
                    enabled: promotersEnabled,
                    commissionType,
                    commissionValue,
                    maxPromoters: promoterLimit,
                },
                revenueSharing: {
                    hostShare,
                    clubShare,
                },
            };

            await onSubmit(eventData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Create New Event</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Step {step} of 4 - {["Basic Info", "Ticketing", "Entry & Promoters", "Review"][step - 1]}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((s) => (
                            <div
                                key={s}
                                className={`flex-1 h-2 rounded-full ${s <= step ? "bg-indigo-600" : "bg-slate-200"
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Step 1: Basic Info */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Event Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="e.g., Techno Bunker: Berlin Edition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Describe the event, music genre, vibe..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Ticketing */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Total Capacity
                                </label>
                                <input
                                    type="number"
                                    value={totalCapacity}
                                    onChange={(e) => setTotalCapacity(parseInt(e.target.value))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-semibold text-slate-700">
                                        Ticket Phases
                                    </label>
                                    <button
                                        onClick={addTicketPhase}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Phase
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {ticketPhases.map((phase, index) => (
                                        <div
                                            key={phase.id}
                                            className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-bold text-slate-700">
                                                    Phase {index + 1}
                                                </span>
                                                {ticketPhases.length > 1 && (
                                                    <button
                                                        onClick={() => removeTicketPhase(phase.id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <input
                                                    type="text"
                                                    value={phase.name}
                                                    onChange={(e) =>
                                                        updateTicketPhase(phase.id, "name", e.target.value)
                                                    }
                                                    placeholder="Phase name"
                                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                />
                                                <input
                                                    type="number"
                                                    value={phase.price}
                                                    onChange={(e) =>
                                                        updateTicketPhase(phase.id, "price", parseInt(e.target.value))
                                                    }
                                                    placeholder="Price (₹)"
                                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                />
                                                <input
                                                    type="number"
                                                    value={phase.quantity}
                                                    onChange={(e) =>
                                                        updateTicketPhase(phase.id, "quantity", parseInt(e.target.value))
                                                    }
                                                    placeholder="Quantity"
                                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Entry & Promoters */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Entry Rules</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Age Limit
                                        </label>
                                        <select
                                            value={ageLimit}
                                            onChange={(e) => setAgeLimit(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                                        >
                                            <option value="18">18+</option>
                                            <option value="21">21+</option>
                                            <option value="25">25+</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Couple Policy
                                        </label>
                                        <select
                                            value={couplePolicy}
                                            onChange={(e) => setCouplePolicy(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                                        >
                                            <option value="required">Couples Only</option>
                                            <option value="preferred">Couples Preferred</option>
                                            <option value="open">Open for All</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Promoter Settings</h3>

                                <div className="mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={promotersEnabled}
                                            onChange={(e) => setPromotersEnabled(e.target.checked)}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">
                                            Enable Promoters
                                        </span>
                                    </label>
                                </div>

                                {promotersEnabled && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Commission Structure
                                            </label>
                                            <div className="flex gap-2 mb-3">
                                                <button
                                                    onClick={() => setCommissionType("percentage")}
                                                    className={`flex-1 px-4 py-3 rounded-lg font-semibold border-2 transition-all ${commissionType === "percentage"
                                                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                                                        }`}
                                                >
                                                    <Percent className="h-5 w-5 mx-auto mb-1" />
                                                    Percentage
                                                </button>
                                                <button
                                                    onClick={() => setCommissionType("amount")}
                                                    className={`flex-1 px-4 py-3 rounded-lg font-semibold border-2 transition-all ${commissionType === "amount"
                                                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                                                        }`}
                                                >
                                                    <DollarSign className="h-5 w-5 mx-auto mb-1" />
                                                    Fixed Amount
                                                </button>
                                            </div>

                                            <input
                                                type="number"
                                                value={commissionValue}
                                                onChange={(e) => setCommissionValue(parseInt(e.target.value))}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                                                placeholder={commissionType === "percentage" ? "e.g., 10" : "e.g., 100"}
                                            />
                                            <p className="text-xs text-slate-500 mt-2">
                                                Promoters earn {commissionValue}
                                                {commissionType === "percentage" ? "%" : "₹"} per ticket sold
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Max Promoters Allowed
                                            </label>
                                            <input
                                                type="number"
                                                value={promoterLimit}
                                                onChange={(e) => setPromoterLimit(parseInt(e.target.value))}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Revenue Sharing</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Host Share (%)
                                        </label>
                                        <input
                                            type="number"
                                            value={hostShare}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setHostShare(val);
                                                setVenueShare(100 - val);
                                            }}
                                            max={100}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Venue Share (%)
                                        </label>
                                        <input
                                            type="number"
                                            value={clubShare}
                                            readOnly
                                            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Revenue is split {hostShare}% to host, {clubShare}% to club
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm font-semibold text-blue-900">
                                    📋 Review & Submit
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    Once submitted, this event will be saved as a draft. You can publish it later.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Event Info</p>
                                    <p className="text-lg font-bold text-slate-900">{title || "Untitled Event"}</p>
                                    <p className="text-sm text-slate-600 mt-1">{eventDate} • {startTime} - {endTime}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Capacity</p>
                                        <p className="text-xl font-bold text-slate-900">{totalCapacity}</p>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Ticket Phases</p>
                                        <p className="text-xl font-bold text-slate-900">{ticketPhases.length}</p>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Promoters</p>
                                        <p className="text-xl font-bold text-slate-900">{promotersEnabled ? "Enabled" : "Disabled"}</p>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Host Revenue</p>
                                        <p className="text-xl font-bold text-slate-900">{hostShare}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                        >
                            Back
                        </button>
                    )}

                    {step < 4 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                        >
                            Continue
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !title || !eventDate}
                            className="flex-1 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create Event"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
