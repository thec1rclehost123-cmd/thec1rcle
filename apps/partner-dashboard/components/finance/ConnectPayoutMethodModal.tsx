"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, CreditCard, Landmark, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

type MethodType = "bank_account" | "debit_card";

interface ConnectPayoutMethodModalProps {
    title: string;
    endpoint: string;
    bodyBase?: Record<string, unknown>;
    getHeaders: () => Promise<Record<string, string>>;
    onClose: () => void;
    onAdded: () => void;
}

export function ConnectPayoutMethodModal({
    title,
    endpoint,
    bodyBase,
    getHeaders,
    onClose,
    onAdded,
}: ConnectPayoutMethodModalProps) {
    const [methodType, setMethodType] = useState<MethodType>("bank_account");
    const [bankForm, setBankForm] = useState({
        accountHolderName: "",
        bankName: "",
        ifscCode: "",
        accountNumber: "",
    });
    const [cardForm, setCardForm] = useState({
        cardHolderName: "",
        cardBrand: "",
        cardNumber: "",
        expiryMonth: "",
        expiryYear: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        const payload =
            methodType === "bank_account"
                ? { paymentType: methodType, ...bankForm }
                : { paymentType: methodType, ...cardForm };

        if (methodType === "bank_account" && (!bankForm.accountHolderName || !bankForm.accountNumber)) {
            setError("Account holder name and account number are required.");
            return;
        }
        if (methodType === "debit_card" && (!cardForm.cardHolderName || !cardForm.cardNumber || !cardForm.expiryMonth || !cardForm.expiryYear)) {
            setError("Card holder, card number, and expiry are required.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: await getHeaders(),
                body: JSON.stringify({ ...(bodyBase || {}), ...payload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed");
            onAdded();
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-[520px] overflow-hidden rounded-[28px]"
                style={{ background: "#17171b", border: "1px solid rgba(255,255,255,0.08)" }}
            >
                <div className="flex items-center justify-end px-6 pt-5">
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: "rgba(255,255,255,0.46)" }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="px-8 pb-8">
                    <h2 className="mb-6 text-center text-[26px] font-bold" style={{ color: "rgba(255,255,255,0.96)" }}>
                        {title}
                    </h2>

                    <div className="mb-5 grid grid-cols-2 gap-3">
                        <MethodButton
                            active={methodType === "bank_account"}
                            icon={<Landmark size={18} />}
                            label="Bank Account"
                            onClick={() => setMethodType("bank_account")}
                        />
                        <MethodButton
                            active={methodType === "debit_card"}
                            icon={<CreditCard size={18} />}
                            label="Debit Card"
                            onClick={() => setMethodType("debit_card")}
                        />
                    </div>

                    {error ? (
                        <div className="mb-4 flex items-center gap-2 rounded-[18px] px-4 py-3 text-[13px]" style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    ) : null}

                    <div className="space-y-3">
                        {methodType === "bank_account" ? (
                            <>
                                <ModalInput
                                    placeholder="Account Holder Name"
                                    value={bankForm.accountHolderName}
                                    onChange={(value) => setBankForm((prev) => ({ ...prev, accountHolderName: value }))}
                                />
                                <ModalInput
                                    placeholder="Bank Name"
                                    value={bankForm.bankName}
                                    onChange={(value) => setBankForm((prev) => ({ ...prev, bankName: value }))}
                                />
                                <ModalInput
                                    placeholder="IFSC / Routing Code"
                                    value={bankForm.ifscCode}
                                    onChange={(value) => setBankForm((prev) => ({ ...prev, ifscCode: value.toUpperCase() }))}
                                />
                                <ModalInput
                                    placeholder="Account Number"
                                    value={bankForm.accountNumber}
                                    onChange={(value) => setBankForm((prev) => ({ ...prev, accountNumber: value }))}
                                />
                            </>
                        ) : (
                            <>
                                <ModalInput
                                    placeholder="Card Holder Name"
                                    value={cardForm.cardHolderName}
                                    onChange={(value) => setCardForm((prev) => ({ ...prev, cardHolderName: value }))}
                                />
                                <ModalInput
                                    placeholder="Card Brand"
                                    value={cardForm.cardBrand}
                                    onChange={(value) => setCardForm((prev) => ({ ...prev, cardBrand: value }))}
                                />
                                <ModalInput
                                    placeholder="Debit Card Number"
                                    value={cardForm.cardNumber}
                                    onChange={(value) => setCardForm((prev) => ({ ...prev, cardNumber: value.replace(/\D/g, "") }))}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <ModalInput
                                        placeholder="Expiry Month"
                                        value={cardForm.expiryMonth}
                                        onChange={(value) => setCardForm((prev) => ({ ...prev, expiryMonth: value.replace(/\D/g, "").slice(0, 2) }))}
                                    />
                                    <ModalInput
                                        placeholder="Expiry Year"
                                        value={cardForm.expiryYear}
                                        onChange={(value) => setCardForm((prev) => ({ ...prev, expiryYear: value.replace(/\D/g, "").slice(0, 4) }))}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] py-4 text-[15px] font-bold"
                        style={{ background: "rgba(255,255,255,0.92)", color: "#050505", opacity: loading ? 0.65 : 1 }}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                        {loading ? "Saving..." : methodType === "bank_account" ? "Add Bank Account" : "Add Debit Card"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function MethodButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-[18px] p-4 text-center"
            style={{
                background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"}`,
                color: "rgba(255,255,255,0.92)",
            }}
        >
            <span className="mb-2 inline-flex">{icon}</span>
            <span className="block text-[13px] font-bold">{label}</span>
        </button>
    );
}

function ModalInput({
    placeholder,
    value,
    onChange,
}: {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-[18px] px-5 py-4 text-[14px] outline-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.96)" }}
        />
    );
}
