/**
 * AI Poster Generation Service — Ideogram V3 Engine
 *
 * Client-side service that interfaces with /api/poster/generate.
 * Handles:
 *   - Input validation & prompt sanitization
 *   - Fresh generation on every request (no cache reuse)
 *   - Generation history management
 *   - Style preset + mood + aspect ratio configuration
 *   - Clear error handling with no silent fallbacks
 */

// ============================================
// TYPES
// ============================================

export interface PosterGenerationInput {
  // REQUIRED — Event title rendered on the poster
  eventName: string;

  // Creative direction from the user (free text)
  designPrompt: string;

  // Ideogram-specific options
  stylePreset?: string; // e.g. "neon_nights", "minimal_luxury"
  mood?: string; // e.g. "energetic", "chill", "luxury"
  aspectRatio?: string; // e.g. "poster", "story", "square"
  quality?: "quality" | "default" | "turbo";
  colorScheme?: string; // e.g. "black and gold", "neon pink and blue"

  // Context (auto-populated from form)
  city?: string;
  eventType?: string;
  eventDate?: string;
  includeDate?: boolean;
  includeTextOnPoster?: boolean; // Ideogram renders text directly
  artists?: string;
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
    styleUsed: string;
    enhancedPrompt?: string;
    resolution?: string;
    seed?: number;
    renderingSpeed?: string;
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
  stylePreset: string;
  mood: string;
  isSelected: boolean;
}

// ============================================
// STYLE PRESET OPTIONS (mirrors API)
// ============================================

export interface StyleOption {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "neon_nights",
    label: "Neon Nights",
    description: "Electric neon glow with cyberpunk energy",
    emoji: "💜",
  },
  {
    id: "minimal_luxury",
    label: "Minimal Luxury",
    description: "Clean elegance with gold accents on black",
    emoji: "✨",
  },
  {
    id: "dark_elegance",
    label: "Dark Elegance",
    description: "Moody sophistication with smoke and shadows",
    emoji: "🖤",
  },
  {
    id: "street_hype",
    label: "Street Hype",
    description: "Bold urban energy with graffiti vibes",
    emoji: "🔥",
  },
  {
    id: "holographic",
    label: "Holographic",
    description: "Prismatic iridescent futurism",
    emoji: "🌈",
  },
  {
    id: "retro_wave",
    label: "Retro Wave",
    description: "Synthwave sunset with 80s nostalgia",
    emoji: "🌅",
  },
  { id: "ethereal", label: "Ethereal", description: "Dreamy celestial atmosphere", emoji: "🌌" },
  {
    id: "brutalist",
    label: "Brutalist",
    description: "Raw concrete geometry with stark contrast",
    emoji: "🏗️",
  },
  {
    id: "tropical_heat",
    label: "Tropical Heat",
    description: "Lush jungle vibes with warm golden light",
    emoji: "🌴",
  },
  {
    id: "film_noir",
    label: "Film Noir",
    description: "Cinematic mystery with dramatic shadows",
    emoji: "🎬",
  },
  {
    id: "psychedelic",
    label: "Psychedelic",
    description: "Vivid kaleidoscopic patterns and fractals",
    emoji: "🍄",
  },
  {
    id: "abstract_art",
    label: "Abstract Art",
    description: "Gallery-quality contemporary art",
    emoji: "🎨",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Movie poster blockbuster aesthetic",
    emoji: "🎞️",
  },
  {
    id: "glitch_digital",
    label: "Digital Glitch",
    description: "Corrupted digital aesthetics",
    emoji: "📟",
  },
  {
    id: "indian_festival",
    label: "Desi Festival",
    description: "Vibrant Indian celebration energy",
    emoji: "🪔",
  },
];

export interface MoodOption {
  id: string;
  label: string;
  emoji: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { id: "energetic", label: "Energetic", emoji: "⚡" },
  { id: "chill", label: "Chill", emoji: "🧊" },
  { id: "luxury", label: "Luxury", emoji: "💎" },
  { id: "underground", label: "Underground", emoji: "🕳️" },
  { id: "romantic", label: "Romantic", emoji: "🌹" },
  { id: "wild", label: "Wild", emoji: "🐆" },
  { id: "mysterious", label: "Mysterious", emoji: "🌑" },
  { id: "futuristic", label: "Futuristic", emoji: "🚀" },
  { id: "spiritual", label: "Spiritual", emoji: "🕉️" },
  { id: "rebellious", label: "Rebellious", emoji: "🤘" },
];

export interface AspectRatioOption {
  id: string;
  label: string;
  ratio: string;
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: "poster", label: "Poster", ratio: "3:4" },
  { id: "story", label: "Story", ratio: "9:16" },
  { id: "square", label: "Square", ratio: "1:1" },
  { id: "landscape", label: "Landscape", ratio: "16:9" },
  { id: "tall", label: "Tall", ratio: "2:3" },
];

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
    userFriendlyMessage: "Poster generation failed. Please wait a moment and try again.",
    isRetryable: true,
  },
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    message: "Network request failed",
    userFriendlyMessage: "Unable to connect to AI service. Check your connection and try again.",
    isRetryable: true,
  },
  TIMEOUT: {
    code: "TIMEOUT",
    message: "Generation request timed out",
    userFriendlyMessage: "Generation is taking longer than expected. Please try again.",
    isRetryable: true,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many generation requests",
    userFriendlyMessage: "Too many requests. Please wait 1 minute and try again.",
    isRetryable: true,
  },
  CREDIT_EXHAUSTED: {
    code: "CREDIT_EXHAUSTED",
    message: "API credits exhausted",
    userFriendlyMessage: "AI generation credits have been exhausted. Contact support.",
    isRetryable: false,
  },
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function generateUniqueSignature(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `gen_${timestamp}_${random}`;
}

export function validatePosterInput(input: PosterGenerationInput): PosterGenerationError | null {
  if (!input.eventName || input.eventName.trim() === "") {
    return POSTER_ERRORS.EVENT_NAME_REQUIRED;
  }
  return null;
}

export function sanitizeDesignPrompt(prompt: string): string {
  if (!prompt) return "";

  return prompt
    .replace(/EVENT\s*(TITLE|NAME)\s*:/gi, "")
    .replace(/DESIGN\s*RULES\s*:/gi, "")
    .replace(/STYLE\s*CONSTRAINTS\s*:/gi, "")
    .replace(/IMPORTANT\s*:/gi, "")
    .replace(/my\s*event\s*(is|name|called|titled)\s*[:=]/gi, "")
    .substring(0, 500)
    .trim();
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
   * Generate a new poster with Ideogram V3.
   * Every call produces a fresh, unique image.
   */
  async generatePoster(input: PosterGenerationInput): Promise<PosterGenerationResult> {
    // 1. Validate
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

    // 2. Sanitize
    const sanitizedPrompt = sanitizeDesignPrompt(input.designPrompt);

    // 3. Unique signature for cache busting
    const requestSignature = generateUniqueSignature();

    try {
      // 4. Call the API with Ideogram-specific params
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Generation-Signature": requestSignature,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        body: JSON.stringify({
          eventName: input.eventName.trim(),
          designPrompt: sanitizedPrompt,
          stylePreset: input.stylePreset || "neon_nights",
          mood: input.mood || "energetic",
          category: input.eventType || "Party",
          city: input.city || "Pune",
          aspectRatio: input.aspectRatio || "poster",
          quality: input.quality || "quality",
          colorScheme: input.colorScheme || "",
          eventDate: input.eventDate || null,
          includeDate: input.includeDate || false,
          includeTextOnPoster: input.includeTextOnPoster ?? true,
          artists: input.artists || "",
        }),
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

        if (response.status === 402) {
          return {
            success: false,
            imageUrl: null,
            generationId: "",
            timestamp: new Date().toISOString(),
            error: POSTER_ERRORS.CREDIT_EXHAUSTED,
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
            userFriendlyMessage:
              errorData.message || POSTER_ERRORS.GENERATION_FAILED.userFriendlyMessage,
            isRetryable: true,
          },
        };
      }

      const data = await response.json();

      if (data.success && data.imageUrl) {
        // 5. Add to history
        const historyEntry: GenerationHistoryEntry = {
          generationId: data.generationId,
          imageUrl: data.imageUrl,
          timestamp: data.timestamp,
          eventName: input.eventName,
          designPrompt: sanitizedPrompt,
          stylePreset: input.stylePreset || "neon_nights",
          mood: input.mood || "energetic",
          isSelected: true,
        };

        this.generationHistory = this.generationHistory.map((entry) => ({
          ...entry,
          isSelected: false,
        }));

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
            styleUsed: data.styleUsed || input.stylePreset || "neon_nights",
            enhancedPrompt: data.enhancedPrompt,
            resolution: data.resolution,
            seed: data.seed,
            renderingSpeed: data.renderingSpeed,
            systemContext: {
              city: input.city || "Pune",
              eventType: input.eventType || "Party",
              dateIncluded: input.includeDate || false,
            },
          },
        };
      }

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
   * Regenerate with the same parameters — always fresh, never cached.
   */
  async regenerate(input: PosterGenerationInput): Promise<PosterGenerationResult> {
    this.currentGenerationId = null;
    return this.generatePoster(input);
  }

  getHistory(): GenerationHistoryEntry[] {
    return [...this.generationHistory];
  }

  selectFromHistory(generationId: string): GenerationHistoryEntry | null {
    const entry = this.generationHistory.find((e) => e.generationId === generationId);

    if (entry) {
      this.generationHistory = this.generationHistory.map((e) => ({
        ...e,
        isSelected: e.generationId === generationId,
      }));
      this.currentGenerationId = generationId;
      return entry;
    }

    return null;
  }

  clearHistory(): void {
    this.generationHistory = [];
    this.currentGenerationId = null;
  }

  getCurrentPoster(): GenerationHistoryEntry | null {
    if (!this.currentGenerationId) return null;
    return this.generationHistory.find((e) => e.generationId === this.currentGenerationId) || null;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let serviceInstance: PosterGenerationService | null = null;

export function getPosterGenerationService(): PosterGenerationService {
  if (!serviceInstance) {
    serviceInstance = new PosterGenerationService();
  }
  return serviceInstance;
}

export { PosterGenerationService as default };
