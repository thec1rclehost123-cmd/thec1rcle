"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, Check, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";
import getCroppedImg from "@/lib/utils/cropImage";
import { Loader2 } from "lucide-react";

interface ImageCropModalProps {
    imageSrc: string;
    aspect: number;       // 1 for square logo, 16/9 for cover
    title: string;
    onConfirm: (dataUrl: string) => void;
    onCancel: () => void;
}

export default function ImageCropModal({
    imageSrc,
    aspect,
    title,
    onConfirm,
    onCancel,
}: ImageCropModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
        x: number; y: number; width: number; height: number;
    } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropComplete = useCallback((_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
            onConfirm(dataUrl);
        } finally {
            setIsProcessing(false);
        }
    };

    // 1:1 square → 360px; 21:9 wide banner → 220px tall (keeps modal compact)
    const cropHeight = aspect === 1 ? 360 : 220;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
            onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col overflow-hidden"
                style={{
                    maxWidth: aspect === 1 ? 440 : aspect >= 2 ? 800 : 680,
                    background: "var(--v-card)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--v-r-xl)",
                    boxShadow: "var(--v-shadow-hero)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                    <div>
                        <h3 className="text-[15px] font-bold text-text-primary">{title}</h3>
                        <p className="text-[11px] text-text-tertiary mt-0.5">Drag to reposition · scroll to zoom</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: "var(--text-tertiary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Crop canvas */}
                <div className="relative w-full shrink-0" style={{ height: cropHeight, background: "var(--surface-base)" }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        showGrid
                        style={{
                            containerStyle: { background: "var(--surface-base)" },
                            cropAreaStyle: {
                                border: "2px solid var(--c1rcle-orange)",
                                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                            },
                        }}
                    />
                </div>

                {/* Zoom slider */}
                <div
                    className="flex items-center gap-3 px-6 py-4 shrink-0"
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                    <ZoomOut size={15} className="text-text-tertiary shrink-0" />
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1"
                        style={{ accentColor: "var(--c1rcle-orange)" }}
                    />
                    <ZoomIn size={15} className="text-text-tertiary shrink-0" />
                    <span className="text-[11px] font-mono text-text-tertiary w-8 text-right shrink-0">
                        {zoom.toFixed(1)}×
                    </span>
                </div>

                {/* Actions */}
                <div
                    className="flex items-center justify-end gap-3 px-6 pb-5 pt-1 shrink-0"
                >
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-opacity disabled:opacity-60"
                        style={{ background: "var(--c1rcle-orange)" }}
                    >
                        {isProcessing ? (
                            <><Loader2 size={13} className="animate-spin" /> Processing…</>
                        ) : (
                            <><Check size={13} /> Apply</>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
