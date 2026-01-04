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

    const colorClasses = {
        danger: isTier3 ? "bg-zinc-800" : "bg-red-500",
        warning: "bg-amber-500",
        info: "bg-blue-500"
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md transition-all duration-500">
            <div className={`w-full max-w-lg rounded-[3rem] bg-white border-2 ${isTier3 ? 'border-red-600 shadow-2xl shadow-red-200' : 'border-slate-100 shadow-2xl'} overflow-hidden animate-in zoom-in-95 fade-in duration-300`}>

                <div className="p-10 pb-6 flex justify-between items-start">
                    <div className="flex gap-5 items-center">
                        <div className={`p-4 rounded-2xl ${isTier3 ? 'bg-red-50 text-red-600' : (type === 'danger' ? 'bg-red-50 text-red-600' : type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600')}`}>
                            {isTier3 ? <ShieldAlert className="h-8 w-8" /> : (type === 'info' ? <Info className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />)}
                        </div>
                        <div className="space-y-1">
                            {isTier2 && !isTier3 && (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 w-fit">
                                    <RefreshCcw className="h-3 w-3 text-indigo-600" />
                                    <span className="text-[9px] text-indigo-600 font-black uppercase tracking-widest">Reversible</span>
                                </div>
                            )}
                            {isTier3 && (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-50 border border-red-100 w-fit">
                                    <Timer className="h-3 w-3 text-red-600" />
                                    <span className="text-[9px] text-red-600 font-black uppercase tracking-widest">Cooling Applied</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-50 text-slate-300 hover:text-slate-900 transition-all">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="px-10 space-y-3">
                    <h3 className={`text-3xl font-black tracking-tighter ${isTier3 ? 'text-red-600' : 'text-slate-900'}`}>{isTier3 ? `CRITICAL: ${title}` : title}</h3>
                    <p className="text-base text-slate-500 leading-relaxed font-medium">{message}</p>
                </div>

                <div className="p-10 space-y-8">
                    {isTier3 && (
                        <div className="p-6 rounded-3xl bg-red-50 border border-red-100 space-y-3 shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Governance Disclosure</p>
                            <p className="text-xs text-red-900/60 leading-relaxed font-semibold italic">
                                This action modifies platform financial or identity state. Execution requires dual-signature and a mandatory cooling window.
                            </p>
                        </div>
                    )}

                    {requiresId && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Target identifier</label>
                            <input
                                type="text"
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                placeholder={idPlaceholder}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-bold font-mono placeholder:text-slate-300"
                            />
                        </div>
                    )}

                    {inputLabel && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">{inputLabel}</label>
                            <input
                                type={inputType}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={inputPlaceholder}
                                className="w-full bg-slate-100/50 border border-slate-200 rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-bold placeholder:text-slate-300"
                            />
                        </div>
                    )}

                    {(isTier2 || isTier3) && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center pl-1 pr-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <Link2 className="h-4 w-4" /> Evidence Source
                                </label>
                                <span className="text-[8px] text-red-500 uppercase tracking-widest font-black">Mandatory</span>
                            </div>
                            <input
                                type="url"
                                value={evidence}
                                onChange={(e) => setEvidence(e.target.value)}
                                placeholder="https://evidence.c1rcle.com/..."
                                className={`w-full bg-slate-100/50 border rounded-2xl p-5 text-sm focus:outline-none transition-all font-bold font-mono ${!isEvidenceValid && evidence ? 'border-red-500' : 'border-slate-200 focus:ring-2 focus:ring-slate-900/5 focus:bg-white'}`}
                            />
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex justify-between items-center pl-1 pr-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Governance Justification</label>
                            <span className={`text-[8px] text-slate-400 uppercase tracking-widest font-black ${isReasonValid ? 'text-emerald-500' : ''}`}>
                                {reason.length} / {minReason} Characters
                            </span>
                        </div>
                        <textarea
                            autoFocus={!requiresId && !inputLabel && !(isTier2 || isTier3)}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={(isTier2 || isTier3) ? "Detailed explanation of policy violation..." : "Reason for audit record..."}
                            className={`w-full bg-slate-100/50 border rounded-3xl p-6 text-sm focus:outline-none transition-all min-h-[120px] font-medium resize-none placeholder:text-slate-300 ${!isReasonValid && reason ? 'border-amber-500' : 'border-slate-200 focus:ring-2 focus:ring-slate-900/5 focus:bg-white'}`}
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-5 rounded-2xl bg-white border border-slate-200 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-900 shadow-sm"
                        >
                            Retract
                        </button>
                        <button
                            disabled={!isReasonValid || !isEvidenceValid || (requiresId && !targetId.trim()) || isSubmitting}
                            onClick={handleConfirm}
                            className={`flex-[2] py-5 rounded-2xl ${isTier3 ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : (type === 'danger' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : type === 'warning' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100')} text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed`}
                        >
                            {isSubmitting ? "Executing Auth..." : actionLabel}
                        </button>
                    </div>
                </div>

                <div className={`px-10 py-5 ${isTier3 ? 'bg-red-50' : 'bg-slate-50'} border-t border-slate-100 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isTier3 ? 'bg-red-500' : 'bg-indigo-500'} animate-pulse`}></div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isTier3 ? 'text-red-600' : 'text-slate-400'}`}>
                            {isTier3 ? "Legal Attribution Active" : "Audit Trace Enforced"}
                        </span>
                    </div>
                    <span className="text-[8px] text-slate-300 uppercase tracking-widest font-black leading-none">V2.4 Governance Core</span>
                </div>
            </div>
        </div>
    );
}
