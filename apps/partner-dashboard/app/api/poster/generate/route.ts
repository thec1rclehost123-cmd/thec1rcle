/**
 * AI Poster Generation API — Ideogram V3 Engine
 *
 * Uses Ideogram 3.0 — the industry's best text-on-image AI model.
 * Generates stunning, professional event posters with perfect typography,
 * rich artistic styles, and MagicPrompt enhancement.
 *
 * Primary:  Ideogram V3 (QUALITY mode — best output)
 * Fallback: Ideogram V3 (TURBO mode — faster, still excellent)
 *
 * Features:
 *   - 12 curated style presets for nightlife/events
 *   - MagicPrompt auto-enhancement for richer results
 *   - Multiple aspect ratios (poster, story, square, landscape)
 *   - Quality tiers (quality, default, turbo)
 *   - Perfect text rendering (event name baked into the poster)
 *   - Negative prompt support to avoid bad outputs
 *   - Multiple style types (DESIGN, REALISTIC, GENERAL)
 */

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

// ============================================
// CONFIGURATION
// ============================================

const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;
const IDEOGRAM_API_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate";

// ============================================
// STYLE PRESETS — Curated for Nightlife & Events
// ============================================

interface StylePreset {
  label: string;
  description: string;
  promptTemplate: string;
  negativePrompt: string;
  styleType: "DESIGN" | "REALISTIC" | "GENERAL" | "FICTION";
}

const STYLE_PRESETS: Record<string, StylePreset> = {
  neon_nights: {
    label: "Neon Nights",
    description: "Electric neon glow with cyberpunk energy",
    promptTemplate: `A stunning nightlife event poster with neon-drenched atmosphere. Electric blue and hot pink neon lights pierce through volumetric fog. Dark black background with vivid glowing neon accents. Dramatic rim lighting illuminates the scene. Reflective wet surfaces catch neon reflections. Cyberpunk-inspired visual elements with sharp geometric neon outlines. Ultra-premium nightclub energy.`,
    negativePrompt:
      "daylight, nature, cartoon, childish, blurry, low quality, watermark, stock photo",
    styleType: "DESIGN",
  },
  minimal_luxury: {
    label: "Minimal Luxury",
    description: "Clean elegance with gold accents on black",
    promptTemplate: `A premium luxury event poster with minimalist sophistication. Matte black background with subtle gold and champagne metallic accents. Clean geometric lines and sophisticated negative space. Premium fashion editorial aesthetic. Soft ambient glow with delicate light particles. Ultra-refined typography layout. Opulent yet restrained. High-end brand feel.`,
    negativePrompt: "cluttered, busy, colorful, cartoon, cheap, amateur, blurry, watermark",
    styleType: "DESIGN",
  },
  dark_elegance: {
    label: "Dark Elegance",
    description: "Moody sophistication with smoke and shadows",
    promptTemplate: `An elegant dark-themed event poster. Deep blacks and rich burgundy wine tones. Subtle wisps of smoke drifting across the composition. Dramatic chiaroscuro lighting with cinematic depth. Velvet texture undertones. Mysterious atmospheric perspective. Professional cinematic color grading with warm shadows. Exclusive VIP atmosphere.`,
    negativePrompt: "bright, colorful, cartoon, daylight, childish, blurry, watermark, cheap",
    styleType: "DESIGN",
  },
  street_hype: {
    label: "Street Hype",
    description: "Bold urban energy with graffiti vibes",
    promptTemplate: `An urban street culture event poster with raw energy. Bold graffiti-inspired visual elements and spray paint texture effects. Gritty concrete and brick wall backdrop. High contrast composition with dynamic angular shapes. Hip-hop culture vibes. Dripping paint effects. Vibrant accent colors against dark background. Underground warehouse party aesthetic.`,
    negativePrompt: "clean, corporate, nature, soft, elegant, fancy, watermark, blurry",
    styleType: "DESIGN",
  },
  holographic: {
    label: "Holographic",
    description: "Prismatic iridescent futurism",
    promptTemplate: `A futuristic holographic event poster with prismatic iridescent effects. Chrome and mirror surfaces reflecting rainbow caustics. Translucent overlapping geometric forms. Digital aurora light effects. Y2K futuristic vibes with modern refinement. Gradient mesh color transitions. Pearlescent shimmer across the entire composition.`,
    negativePrompt: "matte, dark, grungy, vintage, old, retro, blurry, watermark, dull",
    styleType: "DESIGN",
  },
  retro_wave: {
    label: "Retro Wave",
    description: "Synthwave sunset with 80s nostalgia",
    promptTemplate: `A synthwave retrowave event poster. Dramatic sunset gradient transitioning from deep purple through magenta to burning orange. Chrome perspective grid extending to the horizon. Palm tree silhouettes framing the scene. 80s nostalgia aesthetic with modern polish. Outrun style geometric sun. Laser lines. VHS-inspired subtle scan line texture.`,
    negativePrompt: "modern minimalist, corporate, plain, boring, watermark, blurry",
    styleType: "DESIGN",
  },
  ethereal: {
    label: "Ethereal",
    description: "Dreamy celestial atmosphere",
    promptTemplate: `An ethereal dreamscape event poster. Soft pastel aurora lights dancing across a twilight sky. Floating luminous particles and gentle lens flares. Celestial atmosphere with cosmic depth. Gentle fog creating depth layers. Opalescent color palette of lavender, rose gold, and soft cyan. Otherworldly serenity meets celebration.`,
    negativePrompt: "dark, grungy, harsh, urban, industrial, dirty, blurry, watermark",
    styleType: "GENERAL",
  },
  brutalist: {
    label: "Brutalist",
    description: "Raw concrete geometry with stark contrast",
    promptTemplate: `A brutalist architecture-inspired event poster. Raw exposed concrete textures and industrial surfaces. Stark geometric shapes with precise angular composition. High contrast black and white with a single bold accent color. Deconstructivist design language. Massive typographic presence. Industrial warehouse aesthetic. Powerful and confrontational.`,
    negativePrompt: "soft, pretty, nature, flowers, pastel, delicate, blurry, watermark",
    styleType: "DESIGN",
  },
  tropical_heat: {
    label: "Tropical Heat",
    description: "Lush jungle vibes with warm golden light",
    promptTemplate: `A tropical nightlife event poster. Lush jungle foliage silhouettes and exotic monstera leaves. Warm amber and deep emerald lighting. Exotic tropical flowers as accents. Luxury resort poolside party vibes. Golden hour warmth with sensual atmosphere. Tiki torch ambient glow. Paradise island celebration.`,
    negativePrompt: "cold, urban, industrial, winter, snow, grey, boring, blurry, watermark",
    styleType: "GENERAL",
  },
  film_noir: {
    label: "Film Noir",
    description: "Cinematic mystery with dramatic shadows",
    promptTemplate: `A cinematic film noir event poster. Dramatic hard shadows and venetian blind light stripe patterns. High contrast black and white tones with subtle warm sepia tinting. Moody rain-soaked reflective surfaces. Detective movie atmosphere. Vintage film grain texture. Cigarette smoke volumetric wisps. Classic Hollywood glamour.`,
    negativePrompt: "colorful, bright, modern, cheerful, happy, cartoon, blurry, watermark",
    styleType: "REALISTIC",
  },
  psychedelic: {
    label: "Psychedelic",
    description: "Vivid kaleidoscopic patterns and fractals",
    promptTemplate: `A psychedelic art event poster. Swirling kaleidoscopic patterns with vivid saturated colors. Liquid art nouveau organic forms flowing and morphing. Fractal geometric patterns. Mandala-inspired circular motifs. Music festival energy. Tie-dye color explosions. Mind-expanding visual journey.`,
    negativePrompt: "minimalist, corporate, clean lines, boring, plain, blurry, watermark",
    styleType: "DESIGN",
  },
  abstract_art: {
    label: "Abstract Art",
    description: "Gallery-quality contemporary art",
    promptTemplate: `An abstract contemporary art event poster. Bold expressive brush strokes and dynamic paint splatter effects. Gallery-quality artistic composition. Color field painting with emotional depth. Modern art museum aesthetic. Acrylic and oil paint textures. Raw artistic energy. Abstract expressionism meets event design.`,
    negativePrompt: "photorealistic, corporate, clean, digital, boring, plain, blurry, watermark",
    styleType: "DESIGN",
  },
  cinematic: {
    label: "Cinematic",
    description: "Movie poster blockbuster aesthetic",
    promptTemplate: `A cinematic blockbuster-style event poster. Dramatic wide-angle composition with epic scale. Volumetric god rays and atmospheric haze. Hollywood movie poster color grading with teal and orange tones. Lens flare accents. Epic dramatic sky. Silhouette focal elements. Professional film production quality.`,
    negativePrompt: "flat, boring, simple, amateur, cartoon, childish, blurry, watermark",
    styleType: "REALISTIC",
  },
  glitch_digital: {
    label: "Digital Glitch",
    description: "Corrupted digital aesthetics",
    promptTemplate: `A glitch art digital event poster. Corrupted digital pixel artifacts and RGB channel splitting. Distorted scan lines and data moshing effects. VHS tracking error aesthetics. Cyberpunk digital corruption. Neon colors bleeding through visual noise. Matrix-inspired digital rain. Intentional visual chaos.`,
    negativePrompt: "clean, natural, organic, traditional, calm, simple, watermark",
    styleType: "DESIGN",
  },
  indian_festival: {
    label: "Desi Festival",
    description: "Vibrant Indian celebration energy",
    promptTemplate: `A vibrant Indian festival event poster. Rich jewel-tone colors — saffron, magenta, royal blue, emerald. Rangoli-inspired geometric patterns. Marigold flower garland motifs. Festival of lights warmth with diyas and sparklers. Mehndi-inspired decorative borders. Bollywood glamour meets modern design. Celebratory firework bursts.`,
    negativePrompt: "dull, grey, western, cold, boring, plain, blurry, watermark",
    styleType: "DESIGN",
  },
};

// ============================================
// MOOD DESCRIPTORS
// ============================================

const MOOD_MAP: Record<string, string> = {
  energetic: "explosive high-energy atmosphere, dynamic movement, adrenaline rush",
  chill: "relaxed laid-back vibes, smooth gradients, cool blue tones, mellow ambiance",
  luxury: "ultra-premium exclusive VIP experience, champagne gold, crystal chandelier luxury",
  underground: "raw underground subculture energy, warehouse rave, industrial pipes, DIY aesthetic",
  romantic: "intimate romantic atmosphere, soft bokeh fairy lights, warm candlelit glow, roses",
  wild: "untamed chaotic celebration, explosive confetti, maximum sensory overload",
  mysterious: "enigmatic mysterious aura, hidden doorways, shadow play, fog machine haze",
  futuristic: "cutting-edge technology aesthetic, hologram displays, sci-fi architecture",
  spiritual: "transcendent meditative energy, sacred geometry, cosmic consciousness",
  rebellious: "punk rock defiance, torn textures, anarchy symbols, counterculture edge",
};

// ============================================
// CATEGORY VISUAL ENHANCEMENTS
// ============================================

const CATEGORY_THEMES: Record<string, string> = {
  Music:
    "DJ booth with turntables, sound wave visualization, concert stage spotlights, bass speaker stacks",
  Art: "artistic gallery installation, paint splatter, sculptural forms, creative expression",
  Fashion: "haute couture runway, model silhouettes, luxury fabric textures, fashion week glamour",
  Tech: "digital circuit patterns, holographic data visualization, futuristic interface",
  "Food & Drink": "gourmet culinary artistry, cocktail glass composition, warm bistro ambiance",
  Party: "disco ball reflections, champagne bottle spray, confetti explosion, dance floor strobe",
  Venue: "premium nightclub interior, bottle service VIP table, ambient mood lighting",
  Social: "sophisticated cocktail hour, rooftop terrace, city skyline at dusk",
  Festival: "massive outdoor stage, crowd silhouettes, pyrotechnics, laser beam array",
  Comedy: "spotlight cone on microphone stand, brick wall backdrop, theatrical warmth",
  Sports: "stadium floodlights, athletic motion blur, competitive intensity",
  Wellness: "zen garden tranquility, meditation space, healing crystal light",
};

// ============================================
// ASPECT RATIOS
// ============================================

type AspectRatioKey = "poster" | "story" | "square" | "landscape" | "tall" | "wide_poster";

const ASPECT_RATIOS: Record<AspectRatioKey, string> = {
  poster: "3:4",
  story: "9:16",
  square: "1:1",
  landscape: "16:9",
  tall: "2:3",
  wide_poster: "4:3",
};

// ============================================
// PROMPT CONSTRUCTION ENGINE
// ============================================

interface PromptInputs {
  eventName: string;
  designPrompt: string;
  stylePreset: string;
  mood: string;
  category: string;
  city: string;
  eventDate?: string | null;
  includeDate?: boolean;
  includeTextOnPoster?: boolean;
  colorScheme?: string;
  artists?: string;
}

function formatDateForPoster(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date
      .toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .toUpperCase();
  } catch {
    return dateStr.toUpperCase();
  }
}

/**
 * Build the ultimate Ideogram prompt.
 *
 * Ideogram V3 excels at text rendering — so we CAN include the event name
 * directly in the generated image. This is the key advantage over Flux/SD.
 */
function buildIdeogramPrompt(inputs: PromptInputs): { prompt: string; negativePrompt: string } {
  const {
    eventName,
    designPrompt,
    stylePreset,
    mood,
    category,
    city,
    eventDate,
    includeDate,
    includeTextOnPoster = true,
    colorScheme,
    artists,
  } = inputs;

  const style = STYLE_PRESETS[stylePreset] || STYLE_PRESETS.neon_nights;
  const moodText = MOOD_MAP[mood] || MOOD_MAP.energetic;
  const categoryText = CATEGORY_THEMES[category] || CATEGORY_THEMES.Party;

  // Build prompt sections
  const sections: string[] = [];

  // 1. Core identity
  sections.push(`A breathtaking professional event poster design`);

  // 2. TEXT ON POSTER — Ideogram's killer feature
  if (includeTextOnPoster) {
    sections.push(
      `The poster prominently features the event title text "${eventName}" as the dominant hero element, displayed in large, bold, stylish typography that is clearly readable and artistically integrated into the design`,
    );

    if (includeDate && eventDate) {
      const formatted = formatDateForPoster(eventDate);
      sections.push(
        `The date "${formatted}" appears in an elegant secondary position below or near the title`,
      );
    }

    if (artists && artists.trim()) {
      sections.push(`Artist/performer names "${artists.trim()}" appear in supporting text`);
    }
  }

  // 3. Style preset (dominant visual direction)
  sections.push(style.promptTemplate);

  // 4. Category-specific visuals
  sections.push(categoryText);

  // 5. Mood layer
  sections.push(moodText);

  // 6. User's custom creative direction
  if (designPrompt) {
    sections.push(`Additional creative direction: ${designPrompt}`);
  }

  // 7. Color scheme
  if (colorScheme) {
    sections.push(`Color palette emphasis: ${colorScheme}`);
  }

  // 8. Location flavor
  if (city) {
    sections.push(`Subtle cultural nod to ${city}, India`);
  }

  // 9. Quality maximizers
  sections.push(
    "Ultra-high quality, award-winning graphic design, print-ready resolution, professional event marketing material, stunning visual impact, share-worthy on social media",
  );

  // Build negative prompt
  const negParts = [
    style.negativePrompt,
    "ugly, deformed, noisy, low quality, blurry, distorted, amateur, poorly designed, generic clip art, stock photo watermark, out of frame, bad anatomy",
  ];

  if (includeTextOnPoster) {
    negParts.push("misspelled text, garbled letters, illegible text, overlapping text");
  }

  return {
    prompt: sections.join(". ") + ".",
    negativePrompt: negParts.join(", "),
  };
}

// ============================================
// IDEOGRAM API INTEGRATION
// ============================================

interface IdeogramImageData {
  url: string;
  is_image_safe: boolean;
  prompt: string;
  resolution: string;
  seed: number;
  style_type: string;
}

interface IdeogramResponse {
  created: string;
  data: IdeogramImageData[];
}

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  enhancedPrompt?: string;
  resolution?: string;
  seed?: number;
  error?: string;
  renderingSpeed?: string;
}

/**
 * Call Ideogram V3 API to generate a poster image.
 * Uses QUALITY rendering by default for the best output.
 * Falls back through TURBO → DEFAULT if QUALITY fails.
 */
async function generateWithIdeogram(
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  styleType: string,
  quality: "QUALITY" | "DEFAULT" | "TURBO" = "QUALITY",
): Promise<GenerationResult> {
  if (!IDEOGRAM_API_KEY) {
    return {
      success: false,
      error:
        "IDEOGRAM_API_KEY is not configured. Get one at ideogram.ai/manage-api and add it to your .env file.",
    };
  }

  // Try each rendering speed tier
  const speeds =
    quality === "QUALITY"
      ? (["QUALITY", "DEFAULT", "TURBO"] as const)
      : quality === "DEFAULT"
        ? (["DEFAULT", "TURBO"] as const)
        : (["TURBO"] as const);

  for (const speed of speeds) {
    console.log(`🎨 Generating with Ideogram V3 [${speed}]...`);

    try {
      const requestBody: Record<string, unknown> = {
        prompt,
        rendering_speed: speed,
        aspect_ratio: aspectRatio,
        magic_prompt: "ON", // Always enhance prompts
        style_type: styleType,
        negative_prompt: negativePrompt,
      };

      const response = await fetch(IDEOGRAM_API_URL, {
        method: "POST",
        headers: {
          "Api-Key": IDEOGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: "Invalid IDEOGRAM_API_KEY. Check your API key at ideogram.ai/manage-api.",
        };
      }

      if (response.status === 429) {
        console.log(`⏳ Rate limited on ${speed}, trying next tier...`);
        continue;
      }

      if (response.status === 402) {
        return {
          success: false,
          error: "Ideogram API credit limit reached. Top up your account at ideogram.ai.",
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Ideogram ${speed} error (${response.status}):`, errorText);
        continue;
      }

      const data: IdeogramResponse = await response.json();

      if (data.data && data.data.length > 0) {
        const image = data.data[0];

        if (!image.is_image_safe) {
          console.log(`⚠️ Image flagged as unsafe on ${speed}, trying next...`);
          continue;
        }

        console.log(`✅ Poster generated with Ideogram V3 [${speed}] — ${image.resolution}`);

        return {
          success: true,
          imageUrl: image.url,
          enhancedPrompt: image.prompt,
          resolution: image.resolution,
          seed: image.seed,
          renderingSpeed: speed,
        };
      }

      console.log(`⚠️ Empty response from ${speed}, trying next...`);
    } catch (error) {
      console.error(`❌ Ideogram ${speed} exception:`, error);
      continue;
    }
  }

  return {
    success: false,
    error: "All rendering speeds failed. Please try again in a moment.",
  };
}

// ============================================
// REQUEST / RESPONSE TYPES
// ============================================

interface PosterRequest {
  eventName: string;
  designPrompt?: string;
  stylePreset?: string;
  mood?: string;
  category?: string;
  city?: string;
  aspectRatio?: string;
  quality?: "quality" | "default" | "turbo";
  colorScheme?: string;
  eventDate?: string;
  includeDate?: boolean;
  includeTextOnPoster?: boolean;
  artists?: string;
}

interface PosterResponse {
  success: boolean;
  imageUrl?: string;
  generationId: string;
  timestamp: string;
  enhancedPrompt?: string;
  resolution?: string;
  seed?: number;
  renderingSpeed?: string;
  styleUsed?: string;
  error?: string;
  message?: string;
}

// ============================================
// POST — Generate Poster
// ============================================

export async function POST(request: NextRequest) {
  const generationId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const body: PosterRequest = await request.json();

    // ── Validate ──
    if (!body.eventName || body.eventName.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          generationId,
          timestamp,
          error: "EVENT_NAME_REQUIRED",
          message: "Event name is required.",
        } satisfies PosterResponse,
        { status: 400 },
      );
    }

    // ── Parse Inputs ──
    const eventName = body.eventName.trim();
    const designPrompt = body.designPrompt?.trim() || "";
    const stylePreset = body.stylePreset || "neon_nights";
    const mood = body.mood || "energetic";
    const category = body.category || "Party";
    const city = body.city || "Pune";
    const aspectRatioKey = (body.aspectRatio || "poster") as AspectRatioKey;
    const aspectRatio = ASPECT_RATIOS[aspectRatioKey] || "3:4";
    const quality = (body.quality?.toUpperCase() || "QUALITY") as "QUALITY" | "DEFAULT" | "TURBO";
    const colorScheme = body.colorScheme || "";
    const eventDate = body.eventDate || null;
    const includeDate = body.includeDate ?? false;
    const includeTextOnPoster = body.includeTextOnPoster ?? true;
    const artists = body.artists || "";

    // Get style config
    const styleConfig = STYLE_PRESETS[stylePreset] || STYLE_PRESETS.neon_nights;

    // ── Build Prompt ──
    const { prompt, negativePrompt } = buildIdeogramPrompt({
      eventName,
      designPrompt,
      stylePreset,
      mood,
      category,
      city,
      eventDate,
      includeDate,
      includeTextOnPoster,
      colorScheme,
      artists,
    });

    console.log("\n" + "═".repeat(60));
    console.log("🎯 IDEOGRAM POSTER GENERATION");
    console.log("═".repeat(60));
    console.log(`📋 ID: ${generationId}`);
    console.log(`🎪 Event: ${eventName}`);
    console.log(`🎨 Style: ${styleConfig.label}`);
    console.log(`🌊 Mood: ${mood}`);
    console.log(`🏷️ Category: ${category}`);
    console.log(`📐 Aspect: ${aspectRatio}`);
    console.log(`⚡ Quality: ${quality}`);
    console.log(`🖋️ Text on poster: ${includeTextOnPoster ? "YES" : "NO"}`);
    console.log(`📅 Date: ${includeDate && eventDate ? eventDate : "—"}`);
    console.log(`🎤 Artists: ${artists || "—"}`);
    console.log(`💬 Custom prompt: ${designPrompt || "(none)"}`);
    console.log("═".repeat(60) + "\n");

    // ── Generate ──
    const result = await generateWithIdeogram(
      prompt,
      negativePrompt,
      aspectRatio,
      styleConfig.styleType,
      quality,
    );

    if (result.success && result.imageUrl) {
      console.log(`✅ Poster ready!`);
      console.log(`   Resolution: ${result.resolution}`);
      console.log(`   Speed: ${result.renderingSpeed}`);
      console.log(`   Seed: ${result.seed}`);

      return NextResponse.json({
        success: true,
        imageUrl: result.imageUrl,
        generationId,
        timestamp,
        enhancedPrompt: result.enhancedPrompt,
        resolution: result.resolution,
        seed: result.seed,
        renderingSpeed: result.renderingSpeed,
        styleUsed: styleConfig.label,
        message: "Poster generated successfully",
      } satisfies PosterResponse);
    }

    // ── Failed ──
    console.error("❌ Generation failed:", result.error);

    return NextResponse.json(
      {
        success: false,
        generationId,
        timestamp,
        error: "GENERATION_FAILED",
        message: result.error || "Generation failed. Please try again.",
      } satisfies PosterResponse,
      { status: 503 },
    );
  } catch (error: unknown) {
    console.error("❌ Poster generation exception:", error);

    return NextResponse.json(
      {
        success: false,
        generationId,
        timestamp,
        error: "GENERATION_FAILED",
        message: "An unexpected error occurred. Please try again.",
      } satisfies PosterResponse,
      { status: 500 },
    );
  }
}

// ============================================
// GET — Health Check + Available Options
// ============================================

export async function GET() {
  const styles = Object.entries(STYLE_PRESETS).map(([key, val]) => ({
    id: key,
    label: val.label,
    description: val.description,
    styleType: val.styleType,
  }));

  const moods = Object.entries(MOOD_MAP).map(([key]) => ({
    id: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
  }));

  const categories = Object.keys(CATEGORY_THEMES);

  const aspectRatios = Object.entries(ASPECT_RATIOS).map(([key, value]) => ({
    id: key,
    ratio: value,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
  }));

  return NextResponse.json({
    status: IDEOGRAM_API_KEY ? "ready" : "missing_api_key",
    engine: "Ideogram V3",
    capabilities: [
      "Perfect text rendering on posters",
      "MagicPrompt auto-enhancement",
      "Multiple artistic style types",
      "Negative prompt support",
      "Quality/speed tiers",
    ],
    renderingSpeeds: {
      quality: "Best output, ~15-20s",
      default: "Balanced, ~8-12s",
      turbo: "Fastest, ~4-6s",
    },
    options: {
      styles,
      moods,
      categories,
      aspectRatios,
    },
  });
}
