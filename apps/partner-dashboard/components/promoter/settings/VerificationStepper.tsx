"use client";

import { useState, useRef } from "react";
import { CheckCircle2, Clock, AlertTriangle, Upload, Loader2, ShieldCheck } from "lucide-react";
import type { PromoterVerification, VerificationStatus } from "@/lib/server/promoterSettingsStore";

const STATUS_CONFIG: Record<
    VerificationStatus,
    { label: string; color: string; icon: React.ReactNode }
> = {
    UNVERIFIED: {
        label: "Unverified",
        color: "text-white/40 bg-white/[0.06]",
        icon: <ShieldCheck className="w-4 h-4" />,
    },
    PENDING: {
        label: "Pending Review",
        color: "text-amber-400 bg-amber-500/10",
        icon: <Clock className="w-4 h-4" />,
    },
    VERIFIED: {
        label: "Verified",
        color: "text-emerald-400 bg-emerald-500/10",
        icon: <CheckCircle2 className="w-4 h-4" />,
    },
    REJECTED: {
        label: "Action Required",
        color: "text-red-400 bg-red-500/10",
        icon: <AlertTriangle className="w-4 h-4" />,
    },
};

const STEPS: VerificationStatus[] = ["UNVERIFIED", "PENDING", "VERIFIED"];

interface Props {
    verification: PromoterVerification | null;
    promoterId: string;
    token: string;
    onUpdated: (v: PromoterVerification) => void;
}

export function VerificationStepper({ verification, promoterId, token, onUpdated }: Props) {
    const status: VerificationStatus = verification?.status ?? "UNVERIFIED";
    const cfg = STATUS_CONFIG[status];

    const [govUploading, setGovUploading] = useState(false);
    const [selfieUploading, setSelfieUploading] = useState(false);
    const [govUrl, setGovUrl] = useState(verification?.govDocUrl ?? "");
    const [selfieUrl, setSelfieUrl] = useState(verification?.selfieUrl ?? "");
    const [error, setError] = useState("");
    const govRef = useRef<HTMLInputElement>(null);
    const selfieRef = useRef<HTMLInputElement>(null);

    const uploadDoc = async (
        file: File,
        type: "gov_id" | "selfie",
        setUrl: (u: string) => void,
        setLoading: (b: boolean) => void
    ) => {
        setLoading(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("promoterId", promoterId);
            fd.append("type", type);
            const uploadRes = await fetch("/api/partners/promoters/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok || !uploadData.url) {
                setError("Upload failed. Try again.");
                return;
            }
            setUrl(uploadData.url);

            // Persist doc URL + transition to PENDING
            const verRes = await fetch("/api/partners/promoters/settings/verification", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    promoterId,
                    ...(type === "gov_id" ? { govDocUrl: uploadData.url } : { selfieUrl: uploadData.url }),
                }),
            });
            const verData = await verRes.json();
            if (verData.verification) onUpdated(verData.verification);
        } catch {
            setError("Network error. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const isVerified = status === "VERIFIED";
    const isPending = status === "PENDING";

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
                {STEPS.map((s, i) => {
                    const stepIndex = STEPS.indexOf(status === "REJECTED" ? "PENDING" : status);
                    const done = i < stepIndex;
                    const active = i === stepIndex;
                    return (
                        <div key={s} className="flex items-center gap-2 flex-1">
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    done
                                        ? "bg-emerald-500 text-white"
                                        : active
                                        ? "bg-violet-500 text-white"
                                        : "bg-white/[0.08] text-white/30"
                                }`}
                            >
                                {done ? "✓" : i + 1}
                            </div>
                            <span
                                className={`text-xs font-medium ${
                                    active ? "text-white/80" : done ? "text-emerald-400" : "text-white/30"
                                }`}
                            >
                                {s === "UNVERIFIED" ? "Upload Docs" : s === "PENDING" ? "Under Review" : "Verified"}
                            </span>
                            {i < STEPS.length - 1 && (
                                <div
                                    className={`flex-1 h-px ${done ? "bg-emerald-500/50" : "bg-white/[0.08]"}`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Status badge */}
            <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}
            >
                {cfg.icon}
                {cfg.label}
            </div>

            {/* Rejection reason */}
            {status === "REJECTED" && verification?.rejectionReason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-300 font-medium">{verification.rejectionReason}</p>
                    <p className="text-[11px] text-red-400/70 mt-1">
                        Please resubmit clearer documents below.
                    </p>
                </div>
            )}

            {/* Pending info */}
            {isPending && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-300 font-medium">
                        Your documents are under review. This typically takes 24–48 hours.
                    </p>
                </div>
            )}

            {/* Verified */}
            {isVerified && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-emerald-300 font-medium">
                        Identity verified. You are eligible for payouts.
                    </p>
                </div>
            )}

            {/* Upload zones (hidden when verified) */}
            {!isVerified && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UploadZone
                        label="Government ID"
                        hint="Aadhaar, PAN, Passport, or Driving Licence"
                        uploaded={!!govUrl || !!verification?.govDocUrl}
                        loading={govUploading}
                        onClick={() => govRef.current?.click()}
                    />
                    <UploadZone
                        label="Selfie"
                        hint="Clear photo holding your ID document"
                        uploaded={!!selfieUrl || !!verification?.selfieUrl}
                        loading={selfieUploading}
                        onClick={() => selfieRef.current?.click()}
                    />
                </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <input
                ref={govRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDoc(f, "gov_id", setGovUrl, setGovUploading);
                }}
            />
            <input
                ref={selfieRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDoc(f, "selfie", setSelfieUrl, setSelfieUploading);
                }}
            />
        </div>
    );
}

function UploadZone({
    label,
    hint,
    uploaded,
    loading,
    onClick,
}: {
    label: string;
    hint: string;
    uploaded: boolean;
    loading: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`w-full p-4 rounded-2xl border-2 border-dashed text-left transition-colors ${
                uploaded
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-white/10 bg-white/[0.02] hover:border-violet-500/40 hover:bg-white/[0.04]"
            } disabled:opacity-60`}
        >
            <div className="flex items-center gap-2 mb-1">
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                ) : uploaded ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                    <Upload className="w-4 h-4 text-white/40" />
                )}
                <span
                    className={`text-sm font-semibold ${
                        uploaded ? "text-emerald-400" : "text-white/70"
                    }`}
                >
                    {loading ? "Uploading…" : uploaded ? "Uploaded" : label}
                </span>
            </div>
            <p className="text-[11px] text-white/30 pl-6">{hint}</p>
        </button>
    );
}
