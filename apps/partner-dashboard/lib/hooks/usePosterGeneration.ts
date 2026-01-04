/**
 * usePosterGeneration Hook
 * 
 * A React hook that provides a clean interface for AI poster generation
 * with all the hardening guarantees built in:
 * 
 * - Strict prompt segmentation (event name separate from design prompt)
 * - Fresh generation on every request (no cache reuse)
 * - Proper error handling with no silent fallbacks
 * - Generation history management
 */

import { useState, useCallback, useRef } from "react";
import {
    PosterGenerationService,
    PosterGenerationInput,
    PosterGenerationResult,
    GenerationHistoryEntry,
    POSTER_ERRORS,
} from "@/lib/services/posterGeneration";

// ============================================
// TYPES
// ============================================

export interface UsePosterGenerationOptions {
    /** Called when generation starts */
    onGenerationStart?: () => void;
    /** Called when generation succeeds */
    onGenerationSuccess?: (result: PosterGenerationResult) => void;
    /** Called when generation fails */
    onGenerationError?: (error: string) => void;
    /** Auto-update form data when poster is generated/selected */
    onPosterChange?: (imageUrl: string | null, generationId: string | null) => void;
}

export interface UsePosterGenerationReturn {
    // State
    isGenerating: boolean;
    error: string | null;
    currentPoster: string | null;
    currentGenerationId: string | null;
    history: GenerationHistoryEntry[];

    // Actions
    generate: (input: PosterGenerationInput) => Promise<PosterGenerationResult>;
    regenerate: (input: PosterGenerationInput) => Promise<PosterGenerationResult>;
    selectFromHistory: (generationId: string) => void;
    clearError: () => void;
    clearHistory: () => void;
    removePoster: () => void;

    // Validation
    canGenerate: (eventName: string) => boolean;
    validationMessage: string | null;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function usePosterGeneration(
    options: UsePosterGenerationOptions = {}
): UsePosterGenerationReturn {
    const {
        onGenerationStart,
        onGenerationSuccess,
        onGenerationError,
        onPosterChange,
    } = options;

    // Service instance (persists across renders)
    const serviceRef = useRef<PosterGenerationService | null>(null);
    if (!serviceRef.current) {
        serviceRef.current = new PosterGenerationService();
    }
    const service = serviceRef.current;

    // State
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPoster, setCurrentPoster] = useState<string | null>(null);
    const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
    const [history, setHistory] = useState<GenerationHistoryEntry[]>([]);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    // ============================================
    // VALIDATION
    // ============================================

    const canGenerate = useCallback((eventName: string): boolean => {
        if (!eventName || eventName.trim() === "") {
            setValidationMessage(POSTER_ERRORS.EVENT_NAME_REQUIRED.userFriendlyMessage);
            return false;
        }
        setValidationMessage(null);
        return true;
    }, []);

    // ============================================
    // GENERATE
    // ============================================

    const generate = useCallback(async (
        input: PosterGenerationInput
    ): Promise<PosterGenerationResult> => {
        // Pre-flight validation
        if (!canGenerate(input.eventName)) {
            const errorResult: PosterGenerationResult = {
                success: false,
                imageUrl: null,
                generationId: "",
                timestamp: new Date().toISOString(),
                error: POSTER_ERRORS.EVENT_NAME_REQUIRED,
            };
            return errorResult;
        }

        // Start generation
        setIsGenerating(true);
        setError(null);
        onGenerationStart?.();

        try {
            const result = await service.generatePoster(input);

            if (result.success && result.imageUrl) {
                // Success
                setCurrentPoster(result.imageUrl);
                setCurrentGenerationId(result.generationId);
                setHistory(service.getHistory());
                onGenerationSuccess?.(result);
                onPosterChange?.(result.imageUrl, result.generationId);
            } else {
                // Failed (but not with an exception)
                const errorMessage = result.error?.userFriendlyMessage ||
                    POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage;
                setError(errorMessage);
                onGenerationError?.(errorMessage);
            }

            return result;

        } catch (err: any) {
            // Exception during generation
            const errorMessage = POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage;
            setError(errorMessage);
            onGenerationError?.(errorMessage);

            return {
                success: false,
                imageUrl: null,
                generationId: "",
                timestamp: new Date().toISOString(),
                error: POSTER_ERRORS.GENERATION_FAILED,
            };

        } finally {
            setIsGenerating(false);
        }
    }, [canGenerate, service, onGenerationStart, onGenerationSuccess, onGenerationError, onPosterChange]);

    // ============================================
    // REGENERATE
    // ============================================

    const regenerate = useCallback(async (
        input: PosterGenerationInput
    ): Promise<PosterGenerationResult> => {
        // Same as generate but explicitly for regeneration
        // (service handles ensuring fresh generation)
        setIsGenerating(true);
        setError(null);
        onGenerationStart?.();

        try {
            const result = await service.regenerate(input);

            if (result.success && result.imageUrl) {
                setCurrentPoster(result.imageUrl);
                setCurrentGenerationId(result.generationId);
                setHistory(service.getHistory());
                onGenerationSuccess?.(result);
                onPosterChange?.(result.imageUrl, result.generationId);
            } else {
                const errorMessage = result.error?.userFriendlyMessage ||
                    POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage;
                setError(errorMessage);
                onGenerationError?.(errorMessage);
            }

            return result;

        } catch (err: any) {
            const errorMessage = POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage;
            setError(errorMessage);
            onGenerationError?.(errorMessage);

            return {
                success: false,
                imageUrl: null,
                generationId: "",
                timestamp: new Date().toISOString(),
                error: POSTER_ERRORS.GENERATION_FAILED,
            };

        } finally {
            setIsGenerating(false);
        }
    }, [service, onGenerationStart, onGenerationSuccess, onGenerationError, onPosterChange]);

    // ============================================
    // SELECT FROM HISTORY
    // ============================================

    const selectFromHistory = useCallback((generationId: string) => {
        const entry = service.selectFromHistory(generationId);
        if (entry) {
            setCurrentPoster(entry.imageUrl);
            setCurrentGenerationId(entry.generationId);
            setHistory(service.getHistory());
            onPosterChange?.(entry.imageUrl, entry.generationId);
        }
    }, [service, onPosterChange]);

    // ============================================
    // UTILITIES
    // ============================================

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const clearHistory = useCallback(() => {
        service.clearHistory();
        setHistory([]);
        setCurrentPoster(null);
        setCurrentGenerationId(null);
        onPosterChange?.(null, null);
    }, [service, onPosterChange]);

    const removePoster = useCallback(() => {
        setCurrentPoster(null);
        setCurrentGenerationId(null);
        onPosterChange?.(null, null);
    }, [onPosterChange]);

    // ============================================
    // RETURN
    // ============================================

    return {
        // State
        isGenerating,
        error,
        currentPoster,
        currentGenerationId,
        history,

        // Actions
        generate,
        regenerate,
        selectFromHistory,
        clearError,
        clearHistory,
        removePoster,

        // Validation
        canGenerate,
        validationMessage,
    };
}

export default usePosterGeneration;
