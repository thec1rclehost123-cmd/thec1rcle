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
                    poster: result.imageUrl,
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
                poster: result.imageUrl,
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
                poster: entry.imageUrl,
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
            updateFormData({
                image: croppedImage,
                poster: croppedImage
            });
            setIsCropping(false);
            setTempImage(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setCurrentGenerationId(null);
        updateFormData({
            image: null,
            poster: null,
            posterGenerationId: null
        });
    };

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-10">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-headline">Asset Management</h2>
                    <p className="text-label mt-1.5 max-w-lg">
                        Define your event's visual identity through high-fidelity assets or creative AI synthesis.
                    </p>
                </div>

                {/* Apple-style Segmented Control */}
                <div className="flex p-1 rounded-[1.25rem] bg-stone-100/80 border border-stone-200/50 w-fit relative">
                    <div className="relative flex">
                        {/* Sliding Background */}
                        <motion.div
                            className="absolute inset-y-0 bg-white rounded-xl shadow-sm ring-1 ring-black/5"
                            initial={false}
                            animate={{
                                x: uploadMode === "manual" ? 0 : "100%",
                                width: "50%"
                            }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        />

                        <button
                            onClick={() => setUploadMode("manual")}
                            className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-colors duration-200 z-10 w-[140px] ${uploadMode === "manual" ? "text-primary" : "text-muted hover:text-primary"
                                }`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setUploadMode("ai")}
                            className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-colors duration-200 z-10 w-[140px] flex items-center justify-center gap-2 ${uploadMode === "ai" ? "text-indigo-600" : "text-muted hover:text-indigo-600"
                                }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" /> AI Engine
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Creative Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left Column: Creative Input */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        {uploadMode === "manual" ? (
                            <motion.div
                                key="manual"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="aspect-[4/5] rounded-[3rem] border-2 border-dashed border-stone-200 bg-stone-50 flex flex-col items-center justify-center text-center transition-all hover:border-indigo-500/30 hover:bg-indigo-50/5 group cursor-pointer relative overflow-hidden"
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />

                                <div className="w-24 h-24 rounded-[2.5rem] bg-white flex items-center justify-center mb-8 shadow-2xl shadow-stone-200/50 group-hover:scale-110 transition-transform duration-700 ease-out border border-stone-100">
                                    <Upload className="w-9 h-9 text-stone-300 group-hover:text-indigo-500 transition-colors duration-500" />
                                </div>

                                <div className="space-y-3 px-12">
                                    <p className="text-headline-sm tracking-tight text-primary">
                                        Source Local Media
                                    </p>
                                    <p className="text-body text-stone-500 leading-relaxed">
                                        Drag your master visual here or click to interface with local files
                                    </p>
                                </div>

                                <div className="mt-12 px-10 py-3.5 bg-stone-900 rounded-2xl text-[11px] font-black text-white uppercase tracking-[0.2em] shadow-xl shadow-stone-200 group-hover:bg-indigo-600 transition-all duration-300">
                                    Mount Asset
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="ai"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="rounded-[3rem] bg-stone-50 border border-stone-200 p-10 flex flex-col space-y-10"
                            >
                                {/* AI Status Card */}
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
                                        <Wand2 className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-headline-sm">Creative Synthesis</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600">
                                                Neural Engine Active
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Identity Sync (Read Only) */}
                                <div className="space-y-4">
                                    <p className="text-label font-black uppercase tracking-widest px-1">Source Context</p>
                                    <div className="p-5 rounded-[1.5rem] bg-white border border-stone-100 shadow-sm relative overflow-hidden group">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                                Event Identity
                                            </span>
                                            <div className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black tracking-widest uppercase border border-emerald-100/50 flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" /> Synced
                                            </div>
                                        </div>
                                        <p className={`text-body-sm font-bold truncate ${eventName ? 'text-primary' : 'text-stone-300 italic'}`}>
                                            {eventName || "Identity details missing from Step 1"}
                                        </p>

                                        {/* Subtle Background Icon */}
                                        <ImageIcon className="absolute -bottom-2 -right-2 w-16 h-16 text-stone-200 opacity-10" />
                                    </div>
                                </div>

                                {/* Creative Direction */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-label font-black uppercase tracking-widest">Aesthetic Intent</p>
                                        <div className="group relative">
                                            <Info className="w-4 h-4 text-stone-300 cursor-help transition-colors hover:text-indigo-400" />
                                            <div className="absolute bottom-full right-0 mb-4 w-72 p-4 bg-stone-900/95 backdrop-blur-md text-white text-[11px] rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 shadow-2xl leading-relaxed border border-stone-800">
                                                Define the visual depth, lighting profiles, and style. The Synthesizer will automatically integrate your event metadata.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={designPrompt}
                                            onChange={(e) => setDesignPrompt(e.target.value)}
                                            placeholder="e.g. Minimalist noir aesthetic, high-contrast spotlighting, premium typography overlay..."
                                            className="w-full min-h-[160px] p-6 rounded-[2rem] bg-white border border-stone-100 text-body-sm placeholder:text-stone-300 focus:outline-none focus:ring-[6px] focus:ring-indigo-50/50 focus:border-indigo-500/20 resize-none transition-all shadow-sm"
                                        />
                                        <div className="absolute bottom-4 right-4 text-[10px] font-bold text-stone-300 pointer-events-none">
                                            {designPrompt.length} chars
                                        </div>
                                    </div>
                                </div>

                                {/* Controls Row */}
                                <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white border border-stone-100 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-colors duration-500 ${includeDate ? 'bg-indigo-50 text-indigo-600' : 'bg-stone-50 text-stone-300'}`}>
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-body-sm font-bold">Incorporate Schedule</p>
                                            <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">
                                                {eventDate ? eventDate : "No date set"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIncludeDate(!includeDate)}
                                        disabled={!eventDate}
                                        className={`w-14 h-8 rounded-full transition-all duration-300 relative ${includeDate && eventDate
                                            ? "bg-indigo-600 shadow-lg shadow-indigo-100"
                                            : "bg-stone-200"
                                            } ${!eventDate ? "opacity-30 cursor-not-allowed" : ""}`}
                                    >
                                        <motion.div
                                            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
                                            animate={{ x: includeDate && eventDate ? 24 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </button>
                                </div>

                                {/* Main Action */}
                                <div className="space-y-4">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !canGenerate}
                                        className={`btn w-full py-5 text-[12px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all duration-500 scale-100 active:scale-95 ${isGenerating
                                            ? "bg-stone-900 text-white opacity-90 cursor-wait"
                                            : canGenerate
                                                ? "btn-primary shadow-2xl shadow-indigo-100"
                                                : "bg-stone-100 text-stone-300 cursor-not-allowed border-stone-200"
                                            }`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                                Synthesizing Data...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Initiate Generation
                                            </>
                                        )}
                                    </button>

                                    {!canGenerate && (
                                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-rose-500">
                                            Event Identity Required for Synthesis
                                        </p>
                                    )}
                                </div>

                                {/* History Interface */}
                                {generationHistory.length > 0 && (
                                    <div className="pt-8 border-t border-stone-200/50">
                                        <button
                                            onClick={() => setShowHistory(!showHistory)}
                                            className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 hover:text-primary transition-colors mb-6 mx-1"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-stone-200" />
                                            History Matrix ({generationHistory.length})
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-500 ${showHistory ? "rotate-180" : ""}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showHistory && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1"
                                                >
                                                    {generationHistory.map((entry) => (
                                                        <button
                                                            key={entry.generationId}
                                                            onClick={() => handleSelectFromHistory(entry.generationId)}
                                                            className={`w-24 h-32 rounded-[1.25rem] overflow-hidden flex-shrink-0 border-4 transition-all duration-500 shadow-lg ${entry.isSelected
                                                                ? "border-indigo-600 ring-[8px] ring-indigo-50/50 scale-105"
                                                                : "border-white hover:border-indigo-100/50"
                                                                }`}
                                                        >
                                                            <img
                                                                src={entry.imageUrl}
                                                                className="w-full h-full object-cover"
                                                                alt="Iteration"
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

                {/* Right Column: Master Production Preview */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-label font-black uppercase tracking-widest">Master Asset</p>
                        {selectedImage && (
                            <div className="px-3 py-1 rounded-full bg-stone-100 text-[10px] font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                            </div>
                        )}
                    </div>

                    <div className="aspect-[4/5] rounded-[3.5rem] bg-stone-50 border border-stone-200 overflow-hidden relative group shadow-2xl shadow-stone-200/40 transition-all duration-700 hover:shadow-indigo-100/40">
                        {selectedImage ? (
                            <>
                                <img
                                    src={selectedImage}
                                    alt="Master Production"
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />

                                {/* Overlay Interactions */}
                                <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-5">
                                    <label className="bg-white text-stone-900 px-10 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] cursor-pointer shadow-2xl hover:scale-105 transition-transform active:scale-95 duration-300">
                                        Swap Master
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </label>
                                    <button
                                        onClick={handleRemoveImage}
                                        className="bg-rose-600/90 text-white px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-xl hover:bg-rose-600 transition-all duration-300"
                                    >
                                        Drop Asset
                                    </button>
                                </div>

                                {/* Status Indicators */}
                                <div className="absolute top-8 right-8 w-14 h-14 rounded-[1.75rem] bg-emerald-500 text-white flex items-center justify-center shadow-2xl ring-[6px] ring-white/30 backdrop-blur-md">
                                    <Check className="w-7 h-7" />
                                </div>

                                {currentGenerationId && (
                                    <div className="absolute top-8 left-8 px-5 py-2.5 rounded-[1.25rem] bg-indigo-600/90 backdrop-blur-xl shadow-2xl border border-white/20">
                                        <span className="text-[10px] text-white font-black uppercase tracking-[0.25em] flex items-center gap-2.5">
                                            <Sparkles className="w-4 h-4" /> AI Generated
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
                                <div className="w-28 h-28 rounded-[3rem] bg-white flex items-center justify-center shadow-2xl shadow-stone-100 border border-stone-50">
                                    <ImageIcon className="w-12 h-12 text-stone-100" />
                                </div>
                                <div className="text-center space-y-2 px-12">
                                    <p className="text-display-xs text-stone-200">
                                        Void Buffer
                                    </p>
                                    <p className="text-body-sm text-stone-400 leading-relaxed max-w-[240px]">
                                        Your master visual will materialize here once sourced or synthesized
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Iteration Control */}
                    {selectedImage && uploadMode === "ai" && (
                        <button
                            onClick={handleRegenerate}
                            disabled={isGenerating || !canGenerate}
                            className="group w-full py-5 rounded-[2rem] bg-stone-50 border border-stone-200 text-[11px] font-black uppercase tracking-[0.2em] text-stone-900 flex items-center justify-center gap-3 hover:bg-white hover:border-indigo-200 transition-all duration-500 shadow-sm active:scale-[0.98]"
                        >
                            <RefreshCw className={`w-4 h-4 group-hover:text-indigo-600 transition-colors ${isGenerating ? "animate-spin" : ""}`} />
                            {isGenerating ? "Synthesizing Iteration..." : "Generate New Iteration"}
                        </button>
                    )}
                </div>
            </div>

            {/* System Specifications Dashboard */}
            <div className="relative group">
                {/* Decorative background element */}
                <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                <div className="relative flex flex-wrap items-center justify-center gap-y-6 gap-x-12 py-8 px-12 rounded-[2.5rem] border border-stone-200 bg-stone-50/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-white shadow-sm flex items-center justify-center border border-stone-100">
                            <ImageIcon className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Dimensions</span>
                            <span className="block text-body-sm font-bold text-primary">1080 × 1350px</span>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-stone-200 hidden md:block" />

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-white shadow-sm flex items-center justify-center border border-stone-100">
                            <Check className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Supported</span>
                            <span className="block text-body-sm font-bold text-primary">JPG, PNG, WebP</span>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-stone-200 hidden md:block" />

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-white shadow-sm flex items-center justify-center border border-stone-100">
                            <Info className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Memory Limit</span>
                            <span className="block text-body-sm font-bold text-primary">Maximum 10MB</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: High Fidelity Cropper */}
            <AnimatePresence>
                {isCropping && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-stone-950/80 backdrop-blur-2xl"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 30, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 30, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white rounded-[3.5rem] w-full max-w-4xl overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/20"
                        >
                            {/* Modal Header */}
                            <div className="px-12 py-10 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                                <div className="space-y-1">
                                    <h3 className="text-display-xs tracking-tight">Refine Visual Asset</h3>
                                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Standard 4:5 Master Ratio</p>
                                </div>
                                <button
                                    onClick={() => setIsCropping(false)}
                                    className="w-14 h-14 flex items-center justify-center hover:bg-stone-200/50 rounded-2xl transition-all duration-300"
                                >
                                    <Trash2 className="w-7 h-7 text-stone-300" />
                                </button>
                            </div>

                            {/* Cropper Workspace */}
                            <div className="relative h-[480px] bg-stone-900 flex items-center justify-center">
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
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

                            {/* Interaction Area */}
                            <div className="p-12 bg-white space-y-10">
                                <div className="space-y-5">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">Optical Scaling</span>
                                        <span className="text-indigo-600 px-4 py-1.5 rounded-full bg-indigo-50 text-[11px] font-black tracking-widest">{zoom.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.01}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>

                                <div className="flex gap-6">
                                    <button
                                        onClick={() => setIsCropping(false)}
                                        className="px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors"
                                    >
                                        Abort Session
                                    </button>
                                    <button
                                        onClick={saveCroppedImage}
                                        className="btn btn-primary flex-1 py-5 rounded-3xl text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
                                    >
                                        Seal & Finalize Master
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
