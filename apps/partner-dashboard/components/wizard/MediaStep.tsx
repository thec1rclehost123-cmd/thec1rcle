"use client";

import { useState, useCallback } from "react";
import {
    Sparkles,
    Image as ImageIcon,
    Wand2,
    RefreshCw,
    Upload,
    Check,
    Clock,
    Trash2,
    ChevronDown,
    Info,
    Palette,
    Zap,
    Type,
    Music,
    Maximize,
    ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/utils/cropImage";
import {
    PosterGenerationService,
    PosterGenerationResult,
    GenerationHistoryEntry,
    STYLE_OPTIONS,
    MOOD_OPTIONS,
    ASPECT_RATIO_OPTIONS,
    StyleOption,
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
// STYLE PRESET CARD
// ============================================

function StyleCard({
    style,
    isSelected,
    onClick
}: {
    style: StyleOption;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`relative flex-shrink-0 w-[130px] p-4 rounded-[1.5rem] border-2 transition-all duration-300 text-left group ${isSelected
                ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 scale-[1.02]"
                : "border-border-subtle bg-surface-base hover:border-indigo-500/30 hover:bg-surface-elevated"
                }`}
        >
            <div className="text-2xl mb-2">{style.emoji}</div>
            <p className={`text-[11px] font-black tracking-wide leading-tight ${isSelected ? "text-indigo-400" : "text-text-primary"}`}>
                {style.label}
            </p>
            <p className="text-[9px] text-text-tertiary mt-1 leading-relaxed line-clamp-2">
                {style.description}
            </p>

            {isSelected && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"
                >
                    <Check className="w-3 h-3 text-text-primary" />
                </motion.div>
            )}
        </button>
    );
}

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

    // Ideogram V3 Options
    const [selectedStyle, setSelectedStyle] = useState("neon_nights");
    const [selectedMood, setSelectedMood] = useState("energetic");
    const [selectedAspectRatio, setSelectedAspectRatio] = useState("poster");
    const [selectedQuality, setSelectedQuality] = useState<"quality" | "default" | "turbo">("quality");
    const [includeDate, setIncludeDate] = useState(false);
    const [includeTextOnPoster, setIncludeTextOnPoster] = useState(true);
    const [colorScheme, setColorScheme] = useState("");
    const [artists, setArtists] = useState("");

    // Advanced panel
    const [showAdvanced, setShowAdvanced] = useState(false);

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
    const eventType = formData.category || "Party";
    const eventDate = formData.startDate || "";

    const canGenerate = eventName.trim().length > 0;
    const isGenerating = generationState === "generating";

    // ============================================
    // HANDLERS - AI GENERATION
    // ============================================

    const handleGenerate = useCallback(async () => {
        if (!canGenerate) {
            setGenerationError("Please enter an event name in Step 1 before generating a poster.");
            setGenerationState("error");
            return;
        }

        setGenerationError(null);
        setGenerationState("generating");

        try {
            const result: PosterGenerationResult = await posterService.generatePoster({
                eventName: eventName.trim(),
                designPrompt: designPrompt.trim() || "Modern, premium nightlife aesthetic with elegant typography",
                stylePreset: selectedStyle,
                mood: selectedMood,
                aspectRatio: selectedAspectRatio,
                quality: selectedQuality,
                colorScheme,
                city,
                eventType,
                eventDate,
                includeDate,
                includeTextOnPoster,
                artists,
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
                setGenerationError(result.error?.userFriendlyMessage || "Poster generation failed. Please try again.");
                setGenerationState("error");
            }
        } catch (error: any) {
            console.error("Generation error:", error);
            setGenerationError("An unexpected error occurred. Please try again.");
            setGenerationState("error");
        }
    }, [eventName, designPrompt, selectedStyle, selectedMood, selectedAspectRatio, selectedQuality, colorScheme, city, eventType, eventDate, includeDate, includeTextOnPoster, artists, canGenerate, posterService, updateFormData]);

    const handleRegenerate = useCallback(async () => {
        setGenerationState("generating");
        setGenerationError(null);

        const result = await posterService.regenerate({
            eventName: eventName.trim(),
            designPrompt: designPrompt.trim() || "Modern, premium nightlife aesthetic",
            stylePreset: selectedStyle,
            mood: selectedMood,
            aspectRatio: selectedAspectRatio,
            quality: selectedQuality,
            colorScheme,
            city,
            eventType,
            eventDate,
            includeDate,
            includeTextOnPoster,
            artists,
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
    }, [eventName, designPrompt, selectedStyle, selectedMood, selectedAspectRatio, selectedQuality, colorScheme, city, eventType, eventDate, includeDate, includeTextOnPoster, artists, posterService, updateFormData]);

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
                    <h2 className="text-headline text-text-primary">Asset Management</h2>
                    <p className="text-label text-text-secondary mt-1.5 max-w-lg">
                        Define your event&apos;s visual identity through high-fidelity assets or creative AI synthesis.
                    </p>
                </div>

                {/* Apple-style Segmented Control */}
                <div className="flex p-1 rounded-[1.25rem] bg-surface-secondary border border-border-subtle w-fit relative">
                    <div className="relative flex">
                        <motion.div
                            className="absolute inset-y-0 bg-text-primary rounded-xl shadow-sm"
                            initial={false}
                            animate={{
                                x: uploadMode === "manual" ? 0 : "100%",
                                width: "50%"
                            }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        />

                        <button
                            onClick={() => setUploadMode("manual")}
                            className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-colors duration-200 z-10 w-[140px] ${uploadMode === "manual" ? "text-text-inverse" : "text-text-tertiary hover:text-text-primary"
                                }`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setUploadMode("ai")}
                            className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-colors duration-200 z-10 w-[140px] flex items-center justify-center gap-2 ${uploadMode === "ai" ? "text-text-inverse" : "text-text-tertiary hover:text-text-primary"
                                }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" /> AI Studio
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
                                className="aspect-[4/5] rounded-[3rem] border-2 border-dashed border-border-default bg-surface-secondary flex flex-col items-center justify-center text-center transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5 group cursor-pointer relative overflow-hidden"
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />

                                <div className="w-24 h-24 rounded-[2.5rem] bg-surface-base flex items-center justify-center mb-8 shadow-2xl shadow-black/5 group-hover:scale-110 transition-transform duration-700 ease-out border border-border-subtle">
                                    <Upload className="w-9 h-9 text-text-tertiary group-hover:text-indigo-500 transition-colors duration-500" />
                                </div>

                                <div className="space-y-3 px-12">
                                    <p className="text-headline-sm tracking-tight text-text-primary">
                                        Source Local Media
                                    </p>
                                    <p className="text-body text-text-secondary leading-relaxed">
                                        Drag your master visual here or click to interface with local files
                                    </p>
                                </div>

                                <div className="mt-12 px-10 py-3.5 bg-text-primary rounded-2xl text-[11px] font-black text-text-inverse uppercase tracking-[0.2em] shadow-xl shadow-black/10 group-hover:bg-indigo-600 transition-all duration-300">
                                    Mount Asset
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="ai"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="rounded-[3rem] bg-surface-secondary border border-border-subtle p-8 flex flex-col space-y-8"
                            >
                                {/* AI Header */}
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-600 text-text-primary flex items-center justify-center shadow-2xl shadow-indigo-500/20 ring-8 ring-indigo-500/5">
                                        <Wand2 className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-headline-sm text-text-primary">Ideogram V3 Studio</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-500">
                                                Best-in-class Text Rendering
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Event Identity (Synced from Step 1) */}
                                <div className="p-4 rounded-[1.25rem] bg-surface-base border border-border-subtle shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                                            Event Identity
                                        </span>
                                        <div className="px-2 py-0.5 rounded-full bg-green-500/10 text-emerald-500 text-[9px] font-black tracking-widest uppercase border border-emerald-500/20 flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-green-500" /> Synced
                                        </div>
                                    </div>
                                    <p className={`text-body-sm font-bold truncate ${eventName ? 'text-text-primary' : 'text-text-tertiary italic'}`}>
                                        {eventName || "Enter event name in Step 1"}
                                    </p>
                                    <ImageIcon className="absolute -bottom-2 -right-2 w-14 h-14 text-text-primary opacity-5" />
                                </div>

                                {/* ─── STYLE PRESET PICKER ─── */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <Palette className="w-4 h-4 text-indigo-500" />
                                        <p className="text-[11px] font-black uppercase tracking-widest text-text-primary">Visual Style</p>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                                        {STYLE_OPTIONS.map((style) => (
                                            <StyleCard
                                                key={style.id}
                                                style={style}
                                                isSelected={selectedStyle === style.id}
                                                onClick={() => setSelectedStyle(style.id)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* ─── MOOD SELECTOR ─── */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        <p className="text-[11px] font-black uppercase tracking-widest text-text-primary">Mood</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {MOOD_OPTIONS.map((mood) => (
                                            <button
                                                key={mood.id}
                                                onClick={() => setSelectedMood(mood.id)}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 flex items-center gap-1.5 ${selectedMood === mood.id
                                                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                                                    : "bg-surface-base text-text-secondary border border-border-subtle hover:border-indigo-500/20"
                                                    }`}
                                            >
                                                <span>{mood.emoji}</span> {mood.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ─── CREATIVE DIRECTION (Free Text) ─── */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-text-primary">Creative Direction</p>
                                        <div className="group relative">
                                            <Info className="w-4 h-4 text-text-tertiary cursor-help transition-colors hover:text-indigo-400" />
                                            <div className="absolute bottom-full right-0 mb-4 w-72 p-4 bg-surface-elevated backdrop-blur-md text-text-primary text-[11px] rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 shadow-2xl leading-relaxed border border-border-strong">
                                                Describe what you want beyond the style preset. e.g. &ldquo;spotlight on a DJ silhouette&rdquo; or &ldquo;fireworks and confetti explosion&rdquo;
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={designPrompt}
                                            onChange={(e) => setDesignPrompt(e.target.value)}
                                            placeholder="e.g. Spotlight on DJ silhouette, massive crowd, confetti rain, laser beams cutting through fog..."
                                            className="w-full min-h-[120px] p-5 rounded-[1.5rem] bg-surface-base border border-border-subtle text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-[6px] focus:ring-indigo-500/10 focus:border-indigo-500/20 resize-none transition-all shadow-sm"
                                        />
                                        <div className="absolute bottom-3 right-4 text-[10px] font-bold text-text-tertiary pointer-events-none">
                                            {designPrompt.length}/500
                                        </div>
                                    </div>
                                </div>

                                {/* ─── ADVANCED OPTIONS ─── */}
                                <div className="border-t border-border-subtle pt-6">
                                    <button
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary hover:text-text-primary transition-colors w-full"
                                    >
                                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? "rotate-90" : ""}`} />
                                        Advanced Options
                                    </button>

                                    <AnimatePresence>
                                        {showAdvanced && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-5 overflow-hidden mt-5"
                                            >
                                                {/* Aspect Ratio */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <Maximize className="w-3.5 h-3.5 text-text-tertiary" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Aspect Ratio</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {ASPECT_RATIO_OPTIONS.map((ar) => (
                                                            <button
                                                                key={ar.id}
                                                                onClick={() => setSelectedAspectRatio(ar.id)}
                                                                className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all ${selectedAspectRatio === ar.id
                                                                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                                                                    : "bg-surface-base text-text-tertiary border border-border-subtle"
                                                                    }`}
                                                            >
                                                                {ar.label} <span className="opacity-50">{ar.ratio}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Quality Tier */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <Zap className="w-3.5 h-3.5 text-text-tertiary" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Quality Tier</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {([
                                                            { id: "quality" as const, label: "Best", desc: "~20s" },
                                                            { id: "default" as const, label: "Balanced", desc: "~10s" },
                                                            { id: "turbo" as const, label: "Fast", desc: "~5s" },
                                                        ]).map((q) => (
                                                            <button
                                                                key={q.id}
                                                                onClick={() => setSelectedQuality(q.id)}
                                                                className={`px-4 py-2.5 rounded-xl text-[10px] font-bold transition-all flex-1 ${selectedQuality === q.id
                                                                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                                                                    : "bg-surface-base text-text-tertiary border border-border-subtle"
                                                                    }`}
                                                            >
                                                                <div className="font-black">{q.label}</div>
                                                                <div className="text-[9px] opacity-60 mt-0.5">{q.desc}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Text on Poster Toggle */}
                                                <div className="flex items-center justify-between p-4 rounded-[1.25rem] bg-surface-base border border-border-subtle">
                                                    <div className="flex items-center gap-3">
                                                        <Type className="w-4 h-4 text-text-tertiary" />
                                                        <div>
                                                            <p className="text-[11px] font-bold text-text-primary">Text on Poster</p>
                                                            <p className="text-[9px] text-text-tertiary">AI renders event title directly</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setIncludeTextOnPoster(!includeTextOnPoster)}
                                                        className={`w-12 h-7 rounded-full transition-all duration-300 relative ${includeTextOnPoster ? "bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-surface-tertiary"}`}
                                                    >
                                                        <motion.div
                                                            className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface-elevated shadow-md"
                                                            animate={{ x: includeTextOnPoster ? 20 : 0 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Include Date Toggle */}
                                                <div className="flex items-center justify-between p-4 rounded-[1.25rem] bg-surface-base border border-border-subtle">
                                                    <div className="flex items-center gap-3">
                                                        <Clock className="w-4 h-4 text-text-tertiary" />
                                                        <div>
                                                            <p className="text-[11px] font-bold text-text-primary">Include Date</p>
                                                            <p className="text-[9px] text-text-tertiary">
                                                                {eventDate || "No date set in Step 1"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setIncludeDate(!includeDate)}
                                                        disabled={!eventDate}
                                                        className={`w-12 h-7 rounded-full transition-all duration-300 relative ${includeDate && eventDate ? "bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-surface-tertiary"
                                                            } ${!eventDate ? "opacity-30 cursor-not-allowed" : ""}`}
                                                    >
                                                        <motion.div
                                                            className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface-elevated shadow-md"
                                                            animate={{ x: includeDate && eventDate ? 20 : 0 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Color Scheme */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <Palette className="w-3.5 h-3.5 text-text-tertiary" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Color Scheme</p>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={colorScheme}
                                                        onChange={(e) => setColorScheme(e.target.value)}
                                                        placeholder="e.g. black and gold, neon pink and blue"
                                                        className="w-full px-4 py-3 rounded-xl bg-surface-base border border-border-subtle text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/20"
                                                    />
                                                </div>

                                                {/* Artists */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <Music className="w-3.5 h-3.5 text-text-tertiary" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">Artist Names</p>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={artists}
                                                        onChange={(e) => setArtists(e.target.value)}
                                                        placeholder="e.g. DJ Snake, Nucleya"
                                                        className="w-full px-4 py-3 rounded-xl bg-surface-base border border-border-subtle text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/20"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* ─── GENERATE BUTTON ─── */}
                                <div className="space-y-3">
                                    {/* Error Display */}
                                    {generationError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-[1.25rem] bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 font-medium"
                                        >
                                            {generationError}
                                        </motion.div>
                                    )}

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !canGenerate}
                                        className={`btn w-full py-5 text-[12px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all duration-500 scale-100 active:scale-95 ${isGenerating
                                            ? "bg-text-primary text-text-inverse opacity-90 cursor-wait"
                                            : generationState === "success"
                                                ? "bg-emerald-600 text-text-primary shadow-2xl shadow-emerald-500/20"
                                                : canGenerate
                                                    ? "btn-primary shadow-2xl shadow-indigo-500/20"
                                                    : "bg-surface-tertiary text-text-tertiary cursor-not-allowed border-border-subtle"
                                            }`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                                Generating Poster...
                                            </>
                                        ) : generationState === "success" ? (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Poster Ready!
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Generate Poster
                                            </>
                                        )}
                                    </button>

                                    {!canGenerate && (
                                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-rose-500">
                                            Event Name Required — Set in Step 1
                                        </p>
                                    )}
                                </div>

                                {/* ─── GENERATION HISTORY ─── */}
                                {generationHistory.length > 0 && (
                                    <div className="pt-6 border-t border-border-subtle">
                                        <button
                                            onClick={() => setShowHistory(!showHistory)}
                                            className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary hover:text-text-primary transition-colors mb-4 mx-1"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-[var(--state-info)]" />
                                            Previous Generations ({generationHistory.length})
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-500 ${showHistory ? "rotate-180" : ""}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showHistory && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide px-1"
                                                >
                                                    {generationHistory.map((entry) => (
                                                        <button
                                                            key={entry.generationId}
                                                            onClick={() => handleSelectFromHistory(entry.generationId)}
                                                            className={`relative w-20 h-28 rounded-[1.25rem] overflow-hidden flex-shrink-0 border-2 transition-all duration-500 shadow-lg ${entry.isSelected
                                                                ? "border-indigo-600 ring-[6px] ring-indigo-500/20 scale-105"
                                                                : "border-[var(--surface-base)] hover:border-indigo-500/20"
                                                                }`}
                                                        >
                                                            <img
                                                                src={entry.imageUrl}
                                                                className="w-full h-full object-cover"
                                                                alt="Generated variation"
                                                            />
                                                            {entry.isSelected && (
                                                                <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                                                                    <Check className="w-2.5 h-2.5 text-text-primary" />
                                                                </div>
                                                            )}
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
                        <p className="text-label font-black uppercase tracking-widest text-text-tertiary">Master Asset</p>
                        {selectedImage && (
                            <div className="px-3 py-1 rounded-full bg-surface-tertiary text-[10px] font-black uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                            </div>
                        )}
                    </div>

                    <div className="aspect-[4/5] rounded-[3.5rem] bg-surface-secondary border border-border-subtle overflow-hidden relative group shadow-2xl shadow-black/5 transition-all duration-700 hover:shadow-indigo-500/10">
                        {selectedImage ? (
                            <>
                                <img
                                    src={selectedImage}
                                    alt="Master Production"
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />

                                {/* Overlay Interactions */}
                                <div className="absolute inset-0 bg-surface-secondary/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-5">
                                    <label className="bg-surface-elevated text-text-primary px-10 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] cursor-pointer shadow-2xl hover:scale-105 transition-transform active:scale-95 duration-300">
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
                                        className="bg-rose-600/90 text-text-primary px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-xl hover:bg-rose-600 transition-all duration-300"
                                    >
                                        Drop Asset
                                    </button>
                                </div>

                                {/* Status Indicators */}
                                <div className="absolute top-8 right-8 w-14 h-14 rounded-[1.75rem] bg-green-500 text-text-primary flex items-center justify-center shadow-2xl ring-[6px] ring-white/20 backdrop-blur-md">
                                    <Check className="w-7 h-7" />
                                </div>

                                {currentGenerationId && (
                                    <div className="absolute top-8 left-8 px-5 py-2.5 rounded-[1.25rem] bg-indigo-600/90 backdrop-blur-xl shadow-2xl border border-border-subtle">
                                        <span className="text-[10px] text-text-primary font-black uppercase tracking-[0.25em] flex items-center gap-2.5">
                                            <Sparkles className="w-4 h-4" /> AI Generated
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
                                {isGenerating ? (
                                    <>
                                        {/* Generating Animation */}
                                        <div className="relative">
                                            <div className="w-28 h-28 rounded-[3rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 animate-pulse">
                                                <Wand2 className="w-12 h-12 text-indigo-500 animate-bounce" />
                                            </div>
                                            <div className="absolute -inset-4 rounded-[3.5rem] border-2 border-dashed border-indigo-500/20 animate-spin" style={{ animationDuration: "8s" }} />
                                        </div>
                                        <div className="text-center space-y-2 px-12">
                                            <p className="text-headline-sm text-indigo-400 animate-pulse">
                                                Generating...
                                            </p>
                                            <p className="text-body-sm text-text-tertiary leading-relaxed max-w-[280px]">
                                                Ideogram V3 is crafting your poster with perfect typography
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-28 h-28 rounded-[3rem] bg-surface-base flex items-center justify-center shadow-2xl shadow-black/5 border border-border-subtle">
                                            <ImageIcon className="w-12 h-12 text-text-tertiary opacity-20" />
                                        </div>
                                        <div className="text-center space-y-2 px-12">
                                            <p className="text-display-xs text-text-primary opacity-20">
                                                Void Buffer
                                            </p>
                                            <p className="text-body-sm text-text-tertiary leading-relaxed max-w-[240px]">
                                                Your master visual will materialize here once sourced or synthesized
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Iteration Control */}
                    {selectedImage && uploadMode === "ai" && (
                        <button
                            onClick={handleRegenerate}
                            disabled={isGenerating || !canGenerate}
                            className="group w-full py-5 rounded-[2rem] bg-surface-secondary border border-border-subtle text-[11px] font-black uppercase tracking-[0.2em] text-text-primary flex items-center justify-center gap-3 hover:bg-surface-elevated hover:border-indigo-500/30 transition-all duration-500 shadow-sm active:scale-[0.98]"
                        >
                            <RefreshCw className={`w-4 h-4 group-hover:text-indigo-600 transition-colors ${isGenerating ? "animate-spin" : ""}`} />
                            {isGenerating ? "Generating New Variation..." : "Generate New Variation"}
                        </button>
                    )}
                </div>
            </div>

            {/* System Specifications Dashboard */}
            <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                <div className="relative flex flex-wrap items-center justify-center gap-y-6 gap-x-12 py-8 px-12 rounded-[2.5rem] border border-border-subtle bg-surface-secondary backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-surface-base shadow-sm flex items-center justify-center border border-border-subtle">
                            <Wand2 className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">Engine</span>
                            <span className="block text-body-sm font-bold text-text-primary">Ideogram V3</span>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-border-subtle hidden md:block" />

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-surface-base shadow-sm flex items-center justify-center border border-border-subtle">
                            <ImageIcon className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">Output</span>
                            <span className="block text-body-sm font-bold text-text-primary">HD Print-Ready</span>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-border-subtle hidden md:block" />

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-surface-base shadow-sm flex items-center justify-center border border-border-subtle">
                            <Type className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">Text</span>
                            <span className="block text-body-sm font-bold text-text-primary">Perfect Rendering</span>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-border-subtle hidden md:block" />

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[1rem] bg-surface-base shadow-sm flex items-center justify-center border border-border-subtle">
                            <Check className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-text-tertiary">Formats</span>
                            <span className="block text-body-sm font-bold text-text-primary">JPG, PNG, WebP</span>
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
                            className="bg-surface-base rounded-[3.5rem] w-full max-w-4xl overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-border-strong"
                        >
                            {/* Modal Header */}
                            <div className="px-12 py-10 border-b border-border-subtle flex items-center justify-between bg-surface-secondary">
                                <div className="space-y-1">
                                    <h3 className="text-display-xs tracking-tight text-text-primary">Refine Visual Asset</h3>
                                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-tertiary">Standard 4:5 Master Ratio</p>
                                </div>
                                <button
                                    onClick={() => setIsCropping(false)}
                                    className="w-14 h-14 flex items-center justify-center hover:bg-surface-tertiary rounded-2xl transition-all duration-300"
                                >
                                    <Trash2 className="w-7 h-7 text-text-tertiary" />
                                </button>
                            </div>

                            {/* Cropper Workspace */}
                            <div className="relative h-[480px] bg-surface-secondary flex items-center justify-center">
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
                            <div className="p-12 bg-surface-base space-y-10">
                                <div className="space-y-5">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary">Optical Scaling</span>
                                        <span className="text-indigo-500 px-4 py-1.5 rounded-full bg-indigo-500/10 text-[11px] font-black tracking-widest">{zoom.toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.01}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>

                                <div className="flex gap-6">
                                    <button
                                        onClick={() => setIsCropping(false)}
                                        className="px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary hover:text-text-primary transition-colors"
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
