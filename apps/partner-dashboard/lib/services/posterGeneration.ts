/**
 * AI Poster Generation Service
 * 
 * This service implements the hardened poster generation logic with:
 * - Strict prompt segmentation (Event Name vs Design Instructions)
 * - Unique generation signatures for cache invalidation
 * - Stateless generation (no memory of previous posters)
 * - Clear error handling with no silent fallbacks
 */

// ============================================
// TYPES
// ============================================

export interface PosterGenerationInput {
    // A. Event Name (Locked Identity) - MANDATORY
    // Single-line, treated as immutable identity per generation
    eventName: string;

    // B. Design Instructions (Creative Intent)
    // Multi-line free text for styling, mood, and visual direction
    designPrompt: string;

    // C. System Context (Hidden from user, auto-injected)
    city?: string;
    eventType?: string;
    eventDate?: string;
    includeDate?: boolean; // Whether to show date on poster
}

export interface PosterGenerationResult {
    success: boolean;
    imageUrl: string | null;
    generationId: string;
    timestamp: string;
    error?: PosterGenerationError;
    metadata?: {
        eventName: string;
        designPrompt: string;
        systemContext: {
            city: string;
            eventType: string;
            dateIncluded: boolean;
        };
    };
}

export interface PosterGenerationError {
    code: string;
    message: string;
    userFriendlyMessage: string;
    isRetryable: boolean;
}

export interface GenerationHistoryEntry {
    generationId: string;
    imageUrl: string;
    timestamp: string;
    eventName: string;
    designPrompt: string;
    isSelected: boolean;
}

// ============================================
// ERROR DEFINITIONS
// ============================================

export const POSTER_ERRORS = {
    EVENT_NAME_REQUIRED: {
        code: "EVENT_NAME_REQUIRED",
        message: "Event name is required for poster generation",
        userFriendlyMessage: "Please enter your event name before generating a poster.",
        isRetryable: false,
    },
    GENERATION_FAILED: {
        code: "GENERATION_FAILED",
        message: "AI image generation failed",
        userFriendlyMessage: "Poster generation failed. The AI service may be busy. Please wait 30 seconds and try again.",
        isRetryable: true,
    },
    NETWORK_ERROR: {
        code: "NETWORK_ERROR",
        message: "Network request failed",
        userFriendlyMessage: "Unable to connect to AI service. Please check your connection and try again.",
        isRetryable: true,
    },
    TIMEOUT: {
        code: "TIMEOUT",
        message: "Generation request timed out",
        userFriendlyMessage: "Generation is taking longer than expected. Please try again in a moment.",
        isRetryable: true,
    },
    RATE_LIMITED: {
        code: "RATE_LIMITED",
        message: "Too many generation requests",
        userFriendlyMessage: "AI is processing too many requests. Please wait 1 minute and try again.",
        isRetryable: true,
    },
    SERVICE_UNAVAILABLE: {
        code: "SERVICE_UNAVAILABLE",
        message: "AI service temporarily unavailable",
        userFriendlyMessage: "AI poster service is temporarily unavailable. Please try again in a few minutes.",
        isRetryable: true,
    },
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generates a unique generation signature to force fresh generation.
 * This ensures each request is treated as new with no cache reuse.
 */
export function generateUniqueSignature(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `gen_${timestamp}_${random}`;
}

/**
 * Validates the input before sending to the API.
 * Returns null if valid, or an error object if invalid.
 */
export function validatePosterInput(input: PosterGenerationInput): PosterGenerationError | null {
    if (!input.eventName || input.eventName.trim() === "") {
        return POSTER_ERRORS.EVENT_NAME_REQUIRED;
    }
    return null;
}

/**
 * Sanitizes user input to prevent prompt injection.
 * Removes any attempts to override the canonical prompt structure.
 */
export function sanitizeDesignPrompt(prompt: string): string {
    if (!prompt) return "";

    // Remove any attempts to inject new sections or override event name
    let sanitized = prompt
        // Remove potential prompt injection patterns
        .replace(/EVENT\s*(TITLE|NAME)\s*:/gi, "")
        .replace(/DESIGN\s*RULES\s*:/gi, "")
        .replace(/STYLE\s*CONSTRAINTS\s*:/gi, "")
        .replace(/IMPORTANT\s*:/gi, "")
        // Remove attempts to specify different event names
        .replace(/my\s*event\s*(is|name|called|titled)\s*[:=]/gi, "")
        // Limit length to prevent abuse
        .substring(0, 500)
        .trim();

    return sanitized;
}

/**
 * Formats an event date for display on poster (if enabled).
 */
export function formatEventDateForPoster(dateString: string): string {
    if (!dateString) return "";

    try {
        const [year, month, day] = dateString.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
        });
    } catch {
        return dateString;
    }
}

// ============================================
// MAIN SERVICE CLASS
// ============================================

export class PosterGenerationService {
    private baseUrl: string;
    private generationHistory: GenerationHistoryEntry[] = [];
    private currentGenerationId: string | null = null;

    constructor(baseUrl: string = "/api/poster/generate") {
        this.baseUrl = baseUrl;
    }

    /**
     * Generate a new poster. This is ALWAYS a fresh generation.
     * 
     * Key guarantees:
     * - Every call produces a new image
     * - No memory of prior generations
     * - No cache reuse
     * - Clear error handling with no silent fallbacks
     */
    async generatePoster(input: PosterGenerationInput): Promise<PosterGenerationResult> {
        // 1. Validate input
        const validationError = validatePosterInput(input);
        if (validationError) {
            return {
                success: false,
                imageUrl: null,
                generationId: "",
                timestamp: new Date().toISOString(),
                error: validationError,
            };
        }

        // 2. Sanitize design prompt
        const sanitizedPrompt = sanitizeDesignPrompt(input.designPrompt);

        // 3. Generate unique signature (critical for cache invalidation)
        const requestSignature = generateUniqueSignature();

        try {
            // 4. Make API request
            const response = await fetch(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Add unique signature to headers for additional cache busting
                    "X-Generation-Signature": requestSignature,
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                },
                body: JSON.stringify({
                    eventName: input.eventName.trim(),
                    designPrompt: sanitizedPrompt,
                    city: input.city || "Pune",
                    eventType: input.eventType || "Music",
                    eventDate: input.eventDate,
                    includeDate: input.includeDate || false,
                }),
                // Prevent caching at the fetch level
                cache: "no-store",
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 429) {
                    return {
                        success: false,
                        imageUrl: null,
                        generationId: "",
                        timestamp: new Date().toISOString(),
                        error: POSTER_ERRORS.RATE_LIMITED,
                    };
                }

                return {
                    success: false,
                    imageUrl: null,
                    generationId: "",
                    timestamp: new Date().toISOString(),
                    error: {
                        code: errorData.error || "API_ERROR",
                        message: errorData.message || "API request failed",
                        userFriendlyMessage: errorData.message || POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage,
                        isRetryable: true,
                    },
                };
            }

            const data = await response.json();

            if (data.success && data.imageUrl) {
                // 5. Store in history (but never auto-reuse)
                const historyEntry: GenerationHistoryEntry = {
                    generationId: data.generationId,
                    imageUrl: data.imageUrl,
                    timestamp: data.timestamp,
                    eventName: input.eventName,
                    designPrompt: sanitizedPrompt,
                    isSelected: true,
                };

                // Mark all previous entries as not selected
                this.generationHistory = this.generationHistory.map(entry => ({
                    ...entry,
                    isSelected: false,
                }));

                // Add new entry
                this.generationHistory.push(historyEntry);
                this.currentGenerationId = data.generationId;

                return {
                    success: true,
                    imageUrl: data.imageUrl,
                    generationId: data.generationId,
                    timestamp: data.timestamp,
                    metadata: {
                        eventName: input.eventName,
                        designPrompt: sanitizedPrompt,
                        systemContext: {
                            city: input.city || "Pune",
                            eventType: input.eventType || "Music",
                            dateIncluded: input.includeDate || false,
                        },
                    },
                };
            }

            // Generation returned but without success
            return {
                success: false,
                imageUrl: null,
                generationId: data.generationId || "",
                timestamp: data.timestamp || new Date().toISOString(),
                error: {
                    code: data.error || "UNKNOWN_ERROR",
                    message: data.message || "Generation failed",
                    userFriendlyMessage: data.message || POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage,
                    isRetryable: true,
                },
            };

        } catch (error: any) {
            console.error("Poster generation service error:", error);

            // Network or timeout error
            const isTimeout = error.name === "AbortError" || error.message?.includes("timeout");

            return {
                success: false,
                imageUrl: null,
                generationId: "",
                timestamp: new Date().toISOString(),
                error: isTimeout ? POSTER_ERRORS.TIMEOUT : POSTER_ERRORS.NETWORK_ERROR,
            };
        }
    }

    /**
     * Regenerate with the same parameters.
     * This is a FRESH generation, not a cache lookup.
     */
    async regenerate(input: PosterGenerationInput): Promise<PosterGenerationResult> {
        // Clear current selection to indicate regeneration is in progress
        this.currentGenerationId = null;

        // Generate fresh - never reuse
        return this.generatePoster(input);
    }

    /**
     * Get generation history for this session.
     * Users can view previous generations but must explicitly select them.
     */
    getHistory(): GenerationHistoryEntry[] {
        return [...this.generationHistory];
    }

    /**
     * Select a previous generation as the active poster.
     * This is an explicit user action, not automatic reuse.
     */
    selectFromHistory(generationId: string): GenerationHistoryEntry | null {
        const entry = this.generationHistory.find(e => e.generationId === generationId);

        if (entry) {
            this.generationHistory = this.generationHistory.map(e => ({
                ...e,
                isSelected: e.generationId === generationId,
            }));
            this.currentGenerationId = generationId;
            return entry;
        }

        return null;
    }

    /**
     * Clear all history and reset state.
     * Used when starting a new event or after publishing.
     */
    clearHistory(): void {
        this.generationHistory = [];
        this.currentGenerationId = null;
    }

    /**
     * Get the currently selected poster.
     */
    getCurrentPoster(): GenerationHistoryEntry | null {
        if (!this.currentGenerationId) return null;
        return this.generationHistory.find(e => e.generationId === this.currentGenerationId) || null;
    }
}

// ============================================
// DEFAULT EXPORT - SINGLETON INSTANCE
// ============================================

// Create a singleton instance for consistent state management
let serviceInstance: PosterGenerationService | null = null;

export function getPosterGenerationService(): PosterGenerationService {
    if (!serviceInstance) {
        serviceInstance = new PosterGenerationService();
    }
    return serviceInstance;
}

// Direct export for simpler usage
export { PosterGenerationService as default };
