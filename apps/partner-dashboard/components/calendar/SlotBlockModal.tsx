"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Unlock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import Toggle from "@/components/ui/Toggle";

interface SlotBlockModalProps {
    venueId: string;
    date: string; // YYYY-MM-DD
    onClose: () => void;
    onSuccess: () => void;
}

export function SlotBlockModal({ venueId, date, onClose, onSuccess }: SlotBlockModalProps) {
    const [isPartial, setIsPartial] = useState(false);
    const [startTime, setStartTime] = useState("18:00");
    const [endTime, setEndTime] = useState("23:59");
    const [note, setNote] = useState("");

    const blockMut = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/venue/slots?venueId=${venueId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    startTime: isPartial ? startTime : null,
                    endTime: isPartial ? endTime : null,
                    note,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "Block failed");
            }
            return res.json();
        },
        onSuccess: () => {
            onSuccess();
            onClose();
        },
    });

    const timeValid = !isPartial || (startTime < endTime);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.97 }}
                    transition={{ type: "spring", damping: 25, stiffness: 400 }}
                    className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl"
                >
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-base font-semibold text-white">Block Date</h2>
                            <p className="text-sm text-zinc-500 mt-0.5">{date}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* Full day vs partial */}
                        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                            <div>
                                <p className="text-sm text-white">Partial day block</p>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    Block only specific hours; hosts see remaining open time
                                </p>
                            </div>
                            <Toggle
                                checked={isPartial}
                                onChange={setIsPartial}
                            />
                        </div>

                        {/* Time range */}
                        <AnimatePresence>
                            {isPartial && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1.5">
                                                Start time
                                            </label>
                                            <Input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1.5">
                                                End time
                                            </label>
                                            <Input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {!timeValid && (
                                        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            End time must be after start time
                                        </p>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Note */}
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1.5">
                                Internal note (optional)
                            </label>
                            <TextArea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="e.g. Private function, maintenance"
                                rows={2}
                            />
                        </div>

                        {blockMut.isError && (
                            <p className="text-sm text-red-400">
                                {(blockMut.error as Error).message}
                            </p>
                        )}
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                            onClick={() => blockMut.mutate()}
                            disabled={blockMut.isPending || (isPartial && !timeValid)}
                        >
                            <Lock className="h-4 w-4 mr-2" />
                            {blockMut.isPending ? "Blocking…" : "Block Slot"}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
