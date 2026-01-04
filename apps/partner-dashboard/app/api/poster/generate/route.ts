/**
 * AI Poster Generation API - HARDENED VERSION
 * 
 * This endpoint generates REAL AI posters using Google Gemini API.
 * NO FALLBACK TO DEMO IMAGES - always generates fresh, unique posters.
 * 
 * Key Features:
 * - Internal creative prompts for professional quality
 * - All user inputs incorporated into generation
 * - Randomization for unique outputs every time
 * - Strict error handling (no silent fallbacks)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCuYYpdH1ZH2FM8UxCYVDrUNmmsbx06amQ";

// Generate UUID using native crypto module
function generateUUID(): string {
    return crypto.randomUUID();
}

// ============================================
// INTERNAL CREATIVE PROMPTING SYSTEM
// ============================================

// Creative style variations for unique outputs
const CREATIVE_STYLES = [
    "cinematic noir with dramatic spotlights and deep shadows",
    "neon-drenched cyberpunk with electric blues and hot pinks",
    "minimalist luxury with gold accents on black velvet",
    "retro-futuristic with chrome gradients and laser lines",
    "dark elegance with smoke effects and ambient glow",
    "urban graffiti art with bold colors and street energy",
    "ethereal dreamscape with soft glows and floating elements",
    "high-contrast brutalist with geometric shapes",
    "vintage film noir with grain texture and moody lighting",
    "holographic iridescent with prismatic light effects"
];

const TYPOGRAPHY_STYLES = [
    "bold sans-serif with neon glow effect",
    "elegant serif with metallic gold finish",
    "futuristic geometric with chrome reflection",
    "hand-drawn artistic with organic flow",
    "minimalist clean with subtle shadow",
    "distressed grunge with urban texture",
    "3D extruded with dramatic depth",
    "art deco inspired with ornate details"
];

const MOOD_ENHANCERS = [
    "exclusive VIP atmosphere",
    "electric underground energy",
    "sophisticated nightlife elegance",
    "raw artistic expression",
    "premium luxury experience",
    "cutting-edge avant-garde",
    "intimate boutique ambiance",
    "high-energy celebration"
];

const VISUAL_ELEMENTS = [
    "with subtle particle effects and light rays",
    "featuring abstract geometric patterns",
    "with bokeh lights in the background",
    "including subtle smoke or mist effects",
    "with dynamic light streaks",
    "featuring gradient color transitions",
    "with textured overlays for depth",
    "including subtle lens flare accents"
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get random element from array for variation
 */
function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get multiple random elements (no duplicates)
 */
function getRandomElements<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Map category to visual theme
 */
function getCategoryTheme(category: string): string {
    const themes: Record<string, string> = {
        "Music": "club music event with DJ booth vibes, sound wave visuals, and concert energy",
        "Art": "artistic gallery event with creative expression, abstract elements, and cultural sophistication",
        "Fashion": "high fashion runway event with glamour, style, and couture elegance",
        "Tech": "tech innovation event with digital aesthetics, modern design, and futuristic elements",
        "Food & Drink": "culinary experience event with gourmet vibes, warm ambiance, and social gathering",
        "Party": "exclusive party event with celebration energy, dance vibes, and nightlife excitement",
        "Club": "premium nightclub event with VIP atmosphere, bottle service vibes, and exclusive energy",
        "Social": "upscale social gathering with networking elegance and sophisticated mingling"
    };
    return themes[category] || "premium nightlife event with exclusive atmosphere";
}

/**
 * Format date for visual display
 */
function formatDateForPoster(dateStr: string): string {
    if (!dateStr) return "";
    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short"
        }).toUpperCase();
    } catch {
        return dateStr;
    }
}

// ============================================
// MASTER PROMPT CONSTRUCTOR
// ============================================

interface PromptInputs {
    eventName: string;
    designPrompt: string;
    city: string;
    category: string;
    eventDate: string | null;
    includeDate: boolean;
    generationId: string;
}

/**
 * Constructs the ultimate AI prompt with internal creative enhancements
 * This combines user input with professional creative direction
 */
function constructMasterPrompt(inputs: PromptInputs): string {
    const {
        eventName,
        designPrompt,
        city,
        category,
        eventDate,
        includeDate,
        generationId
    } = inputs;

    // Random creative elements for uniqueness
    const creativeStyle = getRandomElement(CREATIVE_STYLES);
    const typographyStyle = getRandomElement(TYPOGRAPHY_STYLES);
    const mood = getRandomElement(MOOD_ENHANCERS);
    const visualElement = getRandomElement(VISUAL_ELEMENTS);
    const categoryTheme = getCategoryTheme(category);

    // Date handling
    const formattedDate = eventDate ? formatDateForPoster(eventDate) : null;
    const dateInstruction = includeDate && formattedDate
        ? `Include the date "${formattedDate}" in an elegant, secondary position that complements the title.`
        : "Do NOT include any date or time on the poster.";

    // Build the comprehensive prompt
    const prompt = `
CREATE A STUNNING, PROFESSIONAL EVENT POSTER:

═══════════════════════════════════════════════════════════════
PRIMARY REQUIREMENT - EVENT TITLE:
═══════════════════════════════════════════════════════════════
The event name is: "${eventName}"

This title MUST be:
- The largest, most dominant text element
- Clearly readable and prominently displayed
- Styled with ${typographyStyle}
- Positioned as the clear focal point of the poster

═══════════════════════════════════════════════════════════════
USER'S DESIGN VISION:
═══════════════════════════════════════════════════════════════
${designPrompt || "Modern, premium nightlife aesthetic"}

═══════════════════════════════════════════════════════════════
EVENT CONTEXT:
═══════════════════════════════════════════════════════════════
- Event Type: ${categoryTheme}
- Location: ${city}, India
- Atmosphere: ${mood}

═══════════════════════════════════════════════════════════════
INTERNAL CREATIVE DIRECTION (Professional Enhancement):
═══════════════════════════════════════════════════════════════
Overall Style: Create a ${creativeStyle} aesthetic
Visual Treatment: ${visualElement}
Target Audience: Premium, sophisticated young adults (21-35)
Brand Feel: Exclusive, aspirational, share-worthy on social media

═══════════════════════════════════════════════════════════════
TECHNICAL SPECIFICATIONS:
═══════════════════════════════════════════════════════════════
- Format: Vertical poster (portrait orientation, 4:5 aspect ratio)
- Resolution: High quality, print-ready
- Margins: Clean edges, social-media optimized
- Style: Professional event marketing poster

═══════════════════════════════════════════════════════════════
STRICT RULES:
═══════════════════════════════════════════════════════════════
✓ DO: Make the event title "${eventName}" the hero element
✓ DO: Use cinematic, high-contrast composition
✓ DO: Create a modern, premium feel
✓ DO: Make it unique and artistically compelling

✗ DON'T: Add any text except the event name "${eventName}"
✗ DON'T: Include venue names, prices, or contact info
✗ DON'T: Add watermarks or logos
✗ DON'T: Use stock photo aesthetics
✗ DON'T: Include random slogans or taglines

${dateInstruction}

═══════════════════════════════════════════════════════════════
UNIQUENESS REQUIREMENT:
═══════════════════════════════════════════════════════════════
Generation Seed: ${generationId}
Timestamp: ${Date.now()}

Create a COMPLETELY UNIQUE design. This must be fresh, original,
and different from any previous generation. The composition,
color grading, and artistic treatment should be distinctive.
`.trim();

    return prompt;
}

// ============================================
// GEMINI API INTEGRATION
// ============================================

interface GenerationResult {
    success: boolean;
    imageBase64?: string;
    error?: string;
    retryAfter?: number;
}

/**
 * Generate image using Gemini 2.0 Flash Image Generation model
 */
async function generateWithGemini(prompt: string): Promise<GenerationResult> {
    const models = [
        "gemini-2.0-flash-exp-image-generation",
        "gemini-2.5-flash-image-preview",
        "gemini-2.5-flash-image"
    ];

    for (const model of models) {
        console.log(`🎨 Attempting generation with model: ${model}`);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: prompt
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            responseModalities: ["image", "text"]
                        }
                    }),
                }
            );

            if (response.status === 429) {
                const errorData = await response.json();
                const retryMatch = errorData.error?.message?.match(/retry in (\d+)/i);
                const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60;
                console.log(`⏳ Rate limited on ${model}, retry after ${retryAfter}s`);

                // Try next model instead of waiting
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Model ${model} error:`, response.status, errorText);
                continue;
            }

            const data = await response.json();

            // Extract image from response
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const parts = data.candidates[0].content.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        console.log(`✅ Successfully generated with ${model}`);
                        return {
                            success: true,
                            imageBase64: part.inlineData.data
                        };
                    }
                }
            }

            console.log(`⚠️ No image in ${model} response, trying next...`);

        } catch (error) {
            console.error(`❌ Model ${model} exception:`, error);
            continue;
        }
    }

    // All models failed
    return {
        success: false,
        error: "All Gemini models failed. Please try again in a moment."
    };
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

interface PosterGenerationRequest {
    eventName: string;
    designPrompt: string;
    city?: string;
    eventType?: string;
    eventDate?: string;
    includeDate?: boolean;
}

interface PosterGenerationResponse {
    success: boolean;
    imageUrl?: string;
    imageBase64?: string;
    generationId: string;
    timestamp: string;
    error?: string;
    message?: string;
    model?: string;
}

// ============================================
// API ENDPOINT
// ============================================

export async function POST(request: NextRequest) {
    const generationId = generateUUID();
    const timestamp = new Date().toISOString();

    try {
        const body: PosterGenerationRequest = await request.json();

        // ============================================
        // 1. VALIDATE REQUIRED FIELDS
        // ============================================

        if (!body.eventName || body.eventName.trim() === "") {
            return NextResponse.json({
                success: false,
                generationId,
                timestamp,
                error: "EVENT_NAME_REQUIRED",
                message: "Event name is required for poster generation."
            }, { status: 400 });
        }

        // ============================================
        // 2. PREPARE ALL USER INPUTS
        // ============================================

        const eventName = body.eventName.trim();
        const designPrompt = body.designPrompt?.trim() || "";
        const city = body.city || "Pune";
        const category = body.eventType || "Music";
        const eventDate = body.eventDate || null;
        const includeDate = body.includeDate || false;

        // ============================================
        // 3. CONSTRUCT MASTER PROMPT
        // ============================================

        const masterPrompt = constructMasterPrompt({
            eventName,
            designPrompt,
            city,
            category,
            eventDate,
            includeDate,
            generationId
        });

        console.log("\n" + "=".repeat(60));
        console.log("🎯 AI POSTER GENERATION REQUEST");
        console.log("=".repeat(60));
        console.log(`📋 Generation ID: ${generationId}`);
        console.log(`🎪 Event: ${eventName}`);
        console.log(`🎨 Design: ${designPrompt || "(default)"}`);
        console.log(`📍 City: ${city}`);
        console.log(`🏷️ Category: ${category}`);
        console.log(`📅 Date: ${includeDate && eventDate ? eventDate : "Not included"}`);
        console.log("=".repeat(60) + "\n");

        // ============================================
        // 4. GENERATE IMAGE WITH GEMINI
        // ============================================

        const result = await generateWithGemini(masterPrompt);

        if (result.success && result.imageBase64) {
            // SUCCESS! Return the AI-generated poster
            console.log("✅ Poster generated successfully!");

            return NextResponse.json({
                success: true,
                imageBase64: result.imageBase64,
                imageUrl: `data:image/png;base64,${result.imageBase64}`,
                generationId,
                timestamp,
                message: "AI poster generated successfully"
            } as PosterGenerationResponse);
        }

        // ============================================
        // 5. GENERATION FAILED - NO FALLBACK
        // ============================================

        console.error("❌ Poster generation failed:", result.error);

        return NextResponse.json({
            success: false,
            generationId,
            timestamp,
            error: "GENERATION_FAILED",
            message: result.error || "Poster generation failed. The AI service may be temporarily unavailable. Please try again in a moment."
        }, { status: 503 });

    } catch (error: any) {
        console.error("❌ Poster generation exception:", error);

        return NextResponse.json({
            success: false,
            generationId,
            timestamp,
            error: "GENERATION_FAILED",
            message: "An unexpected error occurred. Please try again."
        }, { status: 500 });
    }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
    return NextResponse.json({
        status: "ready",
        service: "AI Poster Generation",
        models: [
            "gemini-2.0-flash-exp-image-generation",
            "gemini-2.5-flash-image-preview",
            "gemini-2.5-flash-image"
        ],
        note: "No fallback images. All posters are AI-generated."
    });
}
