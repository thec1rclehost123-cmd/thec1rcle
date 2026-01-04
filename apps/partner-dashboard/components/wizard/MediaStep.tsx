"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Sparkles,
    Image as ImageIcon,
    Wand2,
    RefreshCw,
    Upload,
    Check,
    AlertCircle,
    Clock,
    Trash2,
    ChevronDown,
    Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/utils/cropImage";
import {
    PosterGenerationService,
    PosterGenerationResult,
    GenerationHistoryEntry,
    validatePosterInput,
    sanitizeDesignPrompt
} from "@/lib/services/posterGeneration";

// ============================================
// TYPES
// ============================================

interface MediaStepProps {
    formData: {
        title?: string;
        city?: string;
        category?: string;
        startDate?: string;
        image?: string;
        [key: string]: any;
    };
    updateFormData: (updates: Record<string, any>) => void;
}

type UploadMode = "ai" | "manual";
type GenerationState = "idle" | "generating" | "success" | "error";

// ============================================
// COMPONENT
// ============================================

export function MediaStep({ formData, updateFormData }: MediaStepProps) {
    // ============================================
    // STATE
    // ============================================

    // Mode toggle
    const [uploadMode, setUploadMode] = useState<UploadMode>("manual");

    // AI Generation State
    const [designPrompt, setDesignPrompt] = useState("");
    const [generationState, setGenerationState] = useState<GenerationState>("idle");
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationHistory, setGenerationHistory] = useState<GenerationHistoryEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [includeDate, setIncludeDate] = useState(false);

    // Selected Image
    const [selectedImage, setSelectedImage] = useState<string | null>(formData.image || null);
    const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);

    // Cropper State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isCropping, setIsCropping] = useState(false);
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Service instance
    const [posterService] = useState(() => new PosterGenerationService());

    // ============================================
    // DERIVED STATE
    // ============================================

    const eventName = formData.title || "";
    const city = formData.city || "Pune";
    const eventType = formData.category || "Music";
    const eventDate = formData.startDate || "";

    const canGenerate = eventName.trim().length > 0;
    const isGenerating = generationState === "generating";

    // ============================================
    // HANDLERS - AI GENERATION
    // ============================================

    /**
     * Handle AI poster generation.
     * This ALWAYS triggers a fresh generation, never reuses cached images.
     */
    const handleGenerate = useCallback(async () => {
        // Validate event name is present
        if (!canGenerate) {
            setGenerationError("Please enter an event name in Step 1 before generating a poster.");
            setGenerationState("error");
            return;
        }

        // Reset error state
        setGenerationError(null);
        setGenerationState("generating");

        try {
            const result: PosterGenerationResult = await posterService.generatePoster({
                eventName: eventName.trim(),
                designPrompt: designPrompt.trim() || "Modern, premium nightlife aesthetic with elegant typography",
                city,
                eventType,
                eventDate: eventDate,
                includeDate,
            });

            if (result.success && result.imageUrl) {
                // Success! Update states
                setSelectedImage(result.imageUrl);
                setCurrentGenerationId(result.generationId);
                updateFormData({
                    image: result.imageUrl,
                    posterGenerationId: result.generationId,
                });

                // Update history
                setGenerationHistory(posterService.getHistory());
                setGenerationState("success");

                // Reset to idle after a moment
                setTimeout(() => setGenerationState("idle"), 2000);
            } else {
                // Generation failed
                setGenerationError(result.error?.userFriendlyMessage || "Poster generation failed. Please try again.");
                setGenerationState("error");
            }
        } catch (error: any) {
            console.error("Generation error:", error);
            setGenerationError("An unexpected error occurred. Please try again.");
            setGenerationState("error");
        }
    }, [eventName, designPrompt, city, eventType, eventDate, includeDate, canGenerate, posterService, updateFormData]);

    /**
     * Handle regeneration - always a fresh generation, never cached.
     */
    const handleRegenerate = useCallback(async () => {
        // Same as generate, but explicitly signals regeneration
        setGenerationState("generating");
        setGenerationError(null);

        const result = await posterService.regenerate({
            eventName: eventName.trim(),
            designPrompt: designPrompt.trim() || "Modern, premium nightlife aesthetic",
            city,
            eventType,
            eventDate,
            includeDate,
        });

        if (result.success && result.imageUrl) {
            setSelectedImage(result.imageUrl);
            setCurrentGenerationId(result.generationId);
            updateFormData({
                image: result.imageUrl,
                posterGenerationId: result.generationId,
            });
            setGenerationHistory(posterService.getHistory());
            setGenerationState("success");
            setTimeout(() => setGenerationState("idle"), 2000);
        } else {
            setGenerationError(result.error?.userFriendlyMessage || "Regeneration failed. Please try again.");
            setGenerationState("error");
        }
    }, [eventName, designPrompt, city, eventType, eventDate, includeDate, posterService, updateFormData]);

    /**
     * Select a previous generation from history.
     * This is an EXPLICIT user action, not automatic.
     */
    const handleSelectFromHistory = useCallback((generationId: string) => {
        const entry = posterService.selectFromHistory(generationId);
        if (entry) {
            setSelectedImage(entry.imageUrl);
            setCurrentGenerationId(entry.generationId);
            updateFormData({
                image: entry.imageUrl,
                posterGenerationId: entry.generationId,
            });
            setShowHistory(false);
        }
    }, [posterService, updateFormData]);

    // ============================================
    // HANDLERS - MANUAL UPLOAD
    // ============================================

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const url = e.target?.result as string;
                setTempImage(url);
                setIsCropping(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const saveCroppedImage = async () => {
        try {
            const croppedImage = await getCroppedImg(tempImage!, croppedAreaPixels);
            setSelectedImage(croppedImage);
            updateFormData({ image: croppedImage });
            setIsCropping(false);
            setTempImage(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setCurrentGenerationId(null);
        updateFormData({ image: null, posterGenerationId: null });
    };

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex p-1 rounded-xl bg-[#f5f5f7] w-fit">
                <button
                    onClick={() => setUploadMode("manual")}
                    className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${uploadMode === "manual"
                            ? "bg-white text-[#1d1d1f] shadow-sm"
                            : "text-[#86868b] hover:text-[#1d1d1f]"
                        }`}
                >
                    Upload
                </button>
                <button
                    onClick={() => setUploadMode("ai")}
                    className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${uploadMode === "ai"
                            ? "bg-white text-[#1d1d1f] shadow-sm"
                            : "text-[#86868b] hover:text-[#1d1d1f]"
                        }`}
                >
                    <Sparkles className="w-3.5 h-3.5" /> AI Generate
                </button>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-2 gap-6">
                {/* Left Column: Input Area */}
                <div className="space-y-4">
                    <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">
                        {uploadMode === "manual" ? "Upload Image" : "AI Generator"}
                    </p>

                    <AnimatePresence mode="wait">
                        {uploadMode === "manual" ? (
                            <motion.div
                                key="manual"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="aspect-[4/5] rounded-2xl border-2 border-dashed border-[rgba(0,0,0,0.1)] bg-[#f5f5f7] flex flex-col items-center justify-center text-center transition-all hover:border-[#F44A22] hover:bg-[#F44A22]/5 group cursor-pointer relative"
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />

                                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm group-hover:shadow-md transition-shadow">
                                    <Upload className="w-6 h-6 text-[#86868b] group-hover:text-[#F44A22] transition-colors" />
                                </div>

                                <p className="text-[15px] font-medium text-[#1d1d1f] mb-1">
                                    Drop your image here
                                </p>
                                <p className="text-[13px] text-[#86868b] px-8">
                                    or click to browse
                                </p>

                                <div className="mt-6 px-4 py-2 bg-white rounded-full text-[13px] font-medium text-[#F44A22] shadow-sm border border-[#F44A22]/20">
                                    Choose File
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="ai"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="rounded-2xl bg-[#f5f5f7] p-5 flex flex-col"
                            >
                                {/* AI Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F44A22] to-[#ff6b4a] flex items-center justify-center">
                                        <Wand2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[#1d1d1f] text-[14px]">
                                            AI Creative Engine
                                        </p>
                                        <p className="text-[11px] text-[#86868b]">
                                            Describe your vision
                                        </p>
                                    </div>
                                </div>

                                {/* A. Event Name Display (Locked Identity) */}
                                <div className="mb-4 p-3 rounded-xl bg-white border border-[rgba(0,0,0,0.04)]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                                            Event Title
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                            Auto-synced
                                        </span>
                                    </div>
                                    <p className={`text-[15px] font-semibold ${eventName ? 'text-[#1d1d1f]' : 'text-[#86868b] italic'}`}>
                                        {eventName || "Enter event name in Step 1"}
                                    </p>
                                </div>

                                {/* Validation Warning */}
                                {!canGenerate && (
                                    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-[12px] text-amber-800">
                                            Please enter your event name in Step 1 before generating a poster.
                                        </p>
                                    </div>
                                )}

                                {/* B. Design Instructions (Creative Intent) */}
                                <div className="mb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                                            Design Instructions
                                        </span>
                                        <div className="group relative">
                                            <Info className="w-3 h-3 text-[#86868b] cursor-help" />
                                            <div className="absolute bottom-full left-0 mb-1 w-48 p-2 bg-[#1d1d1f] text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                Describe the style, mood, and visual direction. The event name is automatically included.
                                            </div>
                                        </div>
                                    </div>
                                    <textarea
                                        value={designPrompt}
                                        onChange={(e) => setDesignPrompt(e.target.value)}
                                        placeholder="e.g. Dark neon nightlife theme, futuristic typography, black background, glowing accents, premium club vibe..."
                                        className="w-full min-h-[100px] p-4 rounded-xl bg-white border border-[rgba(0,0,0,0.04)] text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]/60 focus:outline-none focus:border-[#F44A22]/40 focus:ring-2 focus:ring-[#F44A22]/10 resize-none transition-all"
                                    />
                                </div>

                                {/* C. Date Toggle (Optional) */}
                                <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-white border border-[rgba(0,0,0,0.04)]">
                                    <div>
                                        <p className="text-[13px] font-medium text-[#1d1d1f]">
                                            Include date on poster
                                        </p>
                                        <p className="text-[11px] text-[#86868b]">
                                            {eventDate ? `Date: ${eventDate}` : "No date set"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIncludeDate(!includeDate)}
                                        disabled={!eventDate}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${includeDate && eventDate
                                                ? "bg-[#34c759]"
                                                : "bg-[#e5e5ea]"
                                            } ${!eventDate ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                        <div
                                            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${includeDate && eventDate ? "translate-x-6" : "translate-x-1"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !canGenerate}
                                    className={`w-full py-3 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-all ${isGenerating
                                            ? "bg-[#86868b] text-white cursor-wait"
                                            : canGenerate
                                                ? "bg-[#1d1d1f] text-white hover:bg-black"
                                                : "bg-[#e5e5ea] text-[#86868b] cursor-not-allowed"
                                        }`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Generating fresh poster...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Poster
                                        </>
                                    )}
                                </button>

                                {/* Error Display */}
                                {generationState === "error" && generationError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2"
                                    >
                                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[12px] text-red-800 font-medium">
                                                {generationError}
                                            </p>
                                            <button
                                                onClick={handleGenerate}
                                                className="text-[11px] text-red-600 hover:text-red-700 font-medium underline mt-1"
                                            >
                                                Try again
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Generation History */}
                                {generationHistory.length > 0 && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setShowHistory(!showHistory)}
                                            className="flex items-center gap-2 text-[12px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                                        >
                                            <Clock className="w-3 h-3" />
                                            Previous versions ({generationHistory.length})
                                            <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showHistory && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="mt-3 flex gap-2 overflow-x-auto pb-2"
                                                >
                                                    {generationHistory.map((entry) => (
                                                        <button
                                                            key={entry.generationId}
                                                            onClick={() => handleSelectFromHistory(entry.generationId)}
                                                            className={`w-14 h-18 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${entry.isSelected
                                                                    ? "border-[#F44A22] ring-2 ring-[#F44A22]/20"
                                                                    : "border-transparent hover:border-[rgba(0,0,0,0.1)]"
                                                                }`}
                                                        >
                                                            <img
                                                                src={entry.imageUrl}
                                                                className="w-full h-full object-cover"
                                                                alt={`Version from ${new Date(entry.timestamp).toLocaleTimeString()}`}
                                                            />
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Column: Preview */}
                <div className="space-y-4">
                    <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide">
                        Preview
                    </p>

                    <div className="aspect-[4/5] rounded-2xl bg-[#f5f5f7] overflow-hidden relative group">
                        {selectedImage ? (
                            <>
                                <img
                                    src={selectedImage}
                                    alt="Selected"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <label className="px-4 py-2 bg-white rounded-full text-[13px] font-medium text-[#1d1d1f] cursor-pointer hover:bg-[#f5f5f7] transition-colors">
                                        Change Image
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </label>
                                    <button
                                        onClick={handleRemoveImage}
                                        className="p-2 bg-white/90 rounded-full text-red-600 hover:bg-white transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#34c759] flex items-center justify-center shadow-lg">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                                {currentGenerationId && (
                                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                                        <span className="text-[10px] text-white font-medium flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> AI Generated
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm">
                                    <ImageIcon className="w-8 h-8 text-[#86868b]/40" />
                                </div>
                                <p className="text-[14px] font-medium text-[#86868b]">
                                    No image selected
                                </p>
                                <p className="text-[12px] text-[#86868b]/60 mt-1">
                                    Upload or generate an image
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Regenerate Button (when image exists) */}
                    {selectedImage && uploadMode === "ai" && (
                        <button
                            onClick={handleRegenerate}
                            disabled={isGenerating || !canGenerate}
                            className="w-full py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.1)] text-[13px] font-medium text-[#1d1d1f] flex items-center justify-center gap-2 hover:bg-[#f5f5f7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                            {isGenerating ? "Regenerating..." : "Generate New Version"}
                        </button>
                    )}
                </div>
            </div>

            {/* Image Specs */}
            <div className="flex items-center justify-center gap-4 py-3 px-6 rounded-xl bg-[#f5f5f7] text-[12px] text-[#86868b]">
                <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]/40" />
                    1080 × 1350px
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]/40" />
                    JPG, PNG, WebP
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]/40" />
                    Max 10MB
                </span>
            </div>

            {/* Cropper Modal */}
            <AnimatePresence>
                {isCropping && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-[#f5f5f7] flex items-center justify-between">
                                <h3 className="text-[17px] font-bold text-[#1d1d1f]">
                                    Crop Poster
                                </h3>
                                <button
                                    onClick={() => setIsCropping(false)}
                                    className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors"
                                >
                                    <ImageIcon className="w-5 h-5 text-[#86868b]" />
                                </button>
                            </div>

                            <div className="relative h-[480px] bg-black">
                                <Cropper
                                    image={tempImage!}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={4 / 5}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                />
                            </div>

                            <div className="p-6 bg-white space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[13px] text-[#86868b]">
                                        <span>Zoom</span>
                                        <span>{zoom.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full h-1 bg-[#f5f5f7] rounded-lg appearance-none cursor-pointer accent-[#1d1d1f]"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setIsCropping(false)}
                                        className="flex-1 py-3 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] font-semibold text-[15px] hover:bg-[#e8e8ed] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveCroppedImage}
                                        className="flex-2 py-3 px-8 rounded-xl bg-[#1d1d1f] text-white font-semibold text-[15px] hover:bg-black transition-colors"
                                    >
                                        Save & Apply
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
