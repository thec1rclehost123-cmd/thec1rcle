"use client";

import { useState } from "react";
import { AlertTriangle, X, Info, RefreshCcw, Link2, ShieldAlert, Timer } from "lucide-react";

export default function AdminConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    actionLabel = "Confirm Action",
    type = "danger",
    requiresId = false,
    idPlaceholder = "Enter ID...",
    inputLabel = null,
    inputType = "text",
    inputPlaceholder = "",
    isTier2 = false,
    isTier3 = false
}) {
    const [reason, setReason] = useState("");
    const [targetId, setTargetId] = useState("");
    const [inputValue, setInputValue] = useState("");
    const [evidence, setEvidence] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const minReason = (isTier2 || isTier3) ? 20 : 5;
    const isReasonValid = reason.trim().length >= minReason;
    const isEvidenceValid = !(isTier2 || isTier3) || (evidence.trim().length > 5 && evidence.startsWith('http'));

    const handleConfirm = async () => {
        if (!isReasonValid) return;
        if (requiresId && !targetId.trim()) return;
        if (!isEvidenceValid) return;

        setIsSubmitting(true);
        try {
            await onConfirm(reason, targetId, inputValue, evidence);
            setReason("");
            setTargetId("");
            setInputValue("");
            setEvidence("");
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm transition-all duration-500">
            <div className={`w-full max-w-lg rounded-xl bg-obsidian-surface border ${isTier3 ? 'border-iris/40 shadow-2xl shadow-iris/10' : 'border-[#ffffff08] shadow-2xl shadow-black'} overflow-hidden animate-in zoom-in-95 fade-in duration-300`}>

                <div className="p-8 pb-4 flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${isTier3 ? 'bg-iris/10 text-iris' : (type === 'danger' ? 'bg-iris/10 text-iris' : type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')}`}>
                            {isTier3 ? <ShieldAlert className="h-6 w-6" strokeWidth={1.5} /> : (type === 'info' ? <Info className="h-6 w-6" strokeWidth={1.5} /> : <AlertTriangle className="h-6 w-6" strokeWidth={1.5} />)}
                        </div>
                        <div className="space-y-1">
                            {isTier2 && !isTier3 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 w-fit">
                                    <RefreshCcw className="h-3 w-3 text-emerald-500" strokeWidth={2} />
                                    <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Reversible</span>
                                </div>
                            )}
                            {isTier3 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-iris/10 border border-iris/20 w-fit">
                                    <Timer className="h-3 w-3 text-iris" strokeWidth={2} />
                                    <span className="text-[9px] text-iris font-bold uppercase tracking-widest">Critical Override</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-all">
                        <X className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                </div>

                <div className="px-8 space-y-2">
                    <h3 className={`text-2xl font-semibold tracking-tight ${isTier3 ? 'text-white' : 'text-white'}`}>{isTier3 ? `CRITICAL OPS: ${title}` : title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed font-medium">{message}</p>
                </div>

                <div className="p-8 space-y-6">
                    {isTier3 && (
                        <div className="p-4 rounded-lg bg-iris/5 border border-iris/10 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-iris">Security Advisory</p>
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                                High-impact structural change detected. This action is immutable and will be recorded in the security audit stream.
                            </p>
                        </div>
                    )}

                    {requiresId && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 pl-1">Target Identifier</label>
                            <input
                                type="text"
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                placeholder={idPlaceholder}
                                className="w-full bg-black/20 border border-[#ffffff08] rounded-lg p-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-mono placeholder:text-zinc-700 text-white"
                            />
                        </div>
                    )}

                    {inputLabel && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 pl-1">{inputLabel}</label>
                            <input
                                type={inputType}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={inputPlaceholder}
                                className="w-full bg-black/20 border border-[#ffffff08] rounded-lg p-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-700 text-white"
                            />
                        </div>
                    )}

                    {(isTier2 || isTier3) && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center pl-1 pr-1">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                    <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Verification Hash / URL
                                </label>
                                <span className="text-[8px] text-iris uppercase tracking-widest font-bold">Mandatory</span>
                            </div>
                            <input
                                type="url"
                                value={evidence}
                                onChange={(e) => setEvidence(e.target.value)}
                                placeholder="https://audit.c1rcle.net/..."
                                className={`w-full bg-black/20 border rounded-lg p-3.5 text-sm focus:outline-none transition-all font-mono text-white ${!isEvidenceValid && evidence ? 'border-iris/40' : 'border-[#ffffff08] focus:ring-1 focus:ring-white/10 focus:bg-zinc-900'}`}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex justify-between items-center pl-1 pr-1">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Operational Logic</label>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${isReasonValid ? 'text-emerald-500' : 'text-zinc-600'}`}>
                                {reason.length} / {minReason} MIN_CHAR
                            </span>
                        </div>
                        <textarea
                            autoFocus={!requiresId && !inputLabel && !(isTier2 || isTier3)}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={(isTier2 || isTier3) ? "Provide formal justification for this override..." : "State rationale for this procedure..."}
                            className={`w-full bg-black/20 border rounded-lg p-4 text-sm focus:outline-none transition-all min-h-[100px] font-medium resize-none placeholder:text-zinc-700 text-white ${!isReasonValid && reason ? 'border-amber-500/40' : 'border-[#ffffff08] focus:ring-1 focus:ring-white/10 focus:bg-zinc-900'}`}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-zinc-400 hover:text-white"
                        >
                            Abort
                        </button>
                        <button
                            disabled={!isReasonValid || !isEvidenceValid || (requiresId && !targetId.trim()) || isSubmitting}
                            onClick={handleConfirm}
                            className={`flex-[1.5] py-3 rounded-lg ${isTier3 ? 'bg-white text-black' : (type === 'danger' ? 'bg-iris text-white shadow-lg shadow-iris/20' : type === 'warning' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20')} text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed`}
                        >
                            {isSubmitting ? "Syncing..." : actionLabel}
                        </button>
                    </div>
                </div>

                <div className={`px-8 py-4 bg-black/20 border-t border-[#ffffff05] flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${isTier3 ? 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'} animate-pulse`}></div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isTier3 ? 'text-iris' : 'text-zinc-500'}`}>
                            {isTier3 ? "Identity Verified" : "Authorized Tunnel"}
                        </span>
                    </div>
                    <span className="text-[8px] text-zinc-700 uppercase tracking-widest font-black leading-none">OS_VERSION 2.4.0</span>
                </div>
            </div>
        </div>
    );
}
