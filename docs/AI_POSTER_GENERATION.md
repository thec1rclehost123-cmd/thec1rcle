# AI Event Poster Generation System

## Overview

The AI Event Poster Generation system has been hardened and refined to be **predictable, professional, repeatable, and trustworthy**. This document describes the architecture, implementation, and guarantees of the system.

---

## Core Principles

### 1. Strict Prompt Segmentation (Critical Rule)

The AI never receives a single free-text blob. Inputs are logically separated:

| Input Type | Description | Example |
|------------|-------------|---------|
| **A. Event Name** | Locked identity, single-line, mandatory | `Neon Horizon Gala` |
| **B. Design Instructions** | Creative intent, styling/mood/visual direction | `Dark neon nightlife theme, futuristic typography` |
| **C. System Context** | Auto-injected, hidden from user | City, Event Type, Date (optional) |

### 2. Canonical Prompt Template

Every generation uses this fixed structure:

```
You are designing a high-quality, professional event poster.

EVENT TITLE (must be clearly visible, readable, and dominant):
"{EVENT_NAME}"

EVENT CONTEXT:
This is a nightlife / social event poster for a premium audience.

USER DESIGN INSTRUCTIONS:
"{DESIGN_PROMPT}"

ADDITIONAL CONTEXT (system-provided):
City: {CITY}
Event Type: {EVENT_TYPE}
Date: {DATE_IF_APPLICABLE}

DESIGN RULES:
- The event title must be the primary focal point
- Typography must match the described mood
- Use cinematic lighting and high-contrast composition
- Avoid clutter and avoid stock-photo aesthetics
- Do NOT invent dates, venues, prices, or extra text
- Do NOT include random slogans or unrelated words
- The poster must feel modern, premium, and shareable

STYLE CONSTRAINTS:
- Vertical poster (4:5 or 3:4 aspect ratio)
- High resolution
- Clean margins
- Social-media ready
- No watermarks

IMPORTANT:
Generate a completely NEW image.
Do not reuse, reference, or resemble any previous generation.

Generation ID: {UUID}
Timestamp: {ISO_TIMESTAMP}
```

### 3. Fresh Image Guarantee

Every generation is treated as completely new:

- **No memory** of prior poster generations for the same event
- **No reuse** of previous prompt context
- **Unique generation signature** (UUID + timestamp) injected into every request
- **Cache-busting headers** on all API requests

### 4. Error Handling (No Silent Fallbacks)

If generation fails:
- ✅ Show clear error message
- ✅ Allow retry
- ❌ Never show previous image
- ❌ Never fall back to cached content
- ❌ Never display stale posters

---

## Architecture

### File Structure

```
apps/partner-dashboard/
├── app/api/poster/generate/
│   └── route.ts                    # API endpoint with canonical prompt construction
├── lib/services/
│   └── posterGeneration.ts         # Core service class with all generation logic
├── lib/hooks/
│   └── usePosterGeneration.ts      # React hook for easy component integration
└── components/wizard/
    └── MediaStep.tsx               # UI component with strict prompt segmentation
```

### Component Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        MediaStep.tsx                            │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Event Name         │  │  Design Instructions             │ │
│  │  (Auto-synced)      │  │  (User input)                    │ │
│  │  [Locked Identity]  │  │  [Creative Intent]               │ │
│  └─────────────────────┘  └──────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│                    ┌────────────────────┐                      │
│                    │  Generate Button   │                      │
│                    └────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    posterGeneration.ts                          │
│  1. Validate input (event name required)                        │
│  2. Sanitize design prompt (prevent injection)                  │
│  3. Generate unique signature (UUID)                            │
│  4. Call API with cache-busting headers                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    /api/poster/generate                         │
│  1. Validate required fields                                    │
│  2. Generate fresh UUID                                         │
│  3. Construct canonical prompt template                         │
│  4. Call AI service (OpenAI/Midjourney/etc)                    │
│  5. Return image URL with generation metadata                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### POST /api/poster/generate

Generate a new event poster.

**Request Body:**
```typescript
{
  eventName: string;       // Required - The event title
  designPrompt: string;    // Required - Design/styling instructions
  city?: string;           // Optional - Default: "Pune"
  eventType?: string;      // Optional - Category (Music, Art, etc.)
  eventDate?: string;      // Optional - Event date (YYYY-MM-DD)
  includeDate?: boolean;   // Optional - Show date on poster
}
```

**Response (Success):**
```typescript
{
  success: true,
  imageUrl: string,        // URL of generated poster
  generationId: string,    // Unique UUID for this generation
  timestamp: string        // ISO timestamp
}
```

**Response (Error):**
```typescript
{
  success: false,
  generationId: "",
  timestamp: string,
  error: string,           // Error code
  message: string          // Human-readable message
}
```

### Error Codes

| Code | Description | User Message |
|------|-------------|--------------|
| `EVENT_NAME_REQUIRED` | No event name provided | "Please enter your event name before generating a poster." |
| `GENERATION_FAILED` | AI service failed | "Poster generation failed. Please try again." |
| `NETWORK_ERROR` | Network request failed | "Unable to connect. Please check your connection." |
| `RATE_LIMITED` | Too many requests | "You've made too many requests. Please wait." |

---

## Usage Examples

### Using the Hook

```tsx
import { usePosterGeneration } from "@/lib/hooks/usePosterGeneration";

function MyComponent({ formData, updateFormData }) {
  const {
    isGenerating,
    error,
    currentPoster,
    generate,
    regenerate,
    history,
    selectFromHistory,
  } = usePosterGeneration({
    onPosterChange: (imageUrl, generationId) => {
      updateFormData({ image: imageUrl, posterGenerationId: generationId });
    },
    onGenerationError: (error) => {
      console.error("Generation failed:", error);
    },
  });

  const handleGenerate = async () => {
    await generate({
      eventName: formData.title,
      designPrompt: "Dark neon nightlife theme...",
      city: formData.city,
      eventType: formData.category,
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "Generating..." : "Generate Poster"}
      </button>
      
      {error && <p className="error">{error}</p>}
      
      {currentPoster && <img src={currentPoster} alt="Event poster" />}
    </div>
  );
}
```

### Using the Service Directly

```typescript
import { PosterGenerationService } from "@/lib/services/posterGeneration";

const service = new PosterGenerationService();

const result = await service.generatePoster({
  eventName: "Neon Horizon Gala",
  designPrompt: "Dark neon nightlife theme, futuristic typography",
  city: "Mumbai",
  eventType: "Club",
});

if (result.success) {
  console.log("Generated:", result.imageUrl);
} else {
  console.error("Failed:", result.error?.userFriendlyMessage);
}
```

---

## Regeneration Rules

When the user:
- ✅ Changes the design instructions → Triggers new generation
- ✅ Changes the event name → Triggers new generation
- ✅ Clicks "Generate Again" → Triggers new generation

The system MUST:
- ✅ Discard any previous image reference
- ✅ Trigger a brand-new generation with fresh UUID
- ✅ Show loading/regenerating state
- ❌ Never silently reuse an old image

---

## Poster Ownership & Persistence

1. Each generated poster attaches to the event draft
2. The latest generation becomes the active poster
3. Previous versions are archived in session history
4. Users can explicitly select from history (not auto-reused)
5. On event publish, the selected poster is locked

---

## Production Integration

### Google Gemini API

The system is configured to use Google's Gemini API for AI image generation:

```bash
# Set your Gemini API key as an environment variable
GEMINI_API_KEY=your_api_key_here
```

**Models Used (in order of preference):**
1. `imagen-3.0-generate-002` - Primary Imagen model (requires billing)
2. `gemini-2.0-flash-exp-image-generation` - Fallback image generation model

**API Endpoints:**
- Imagen: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`
- Gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent`

**Rate Limits:**
- Free tier has limited requests per minute/day
- For production use, enable billing on your Google Cloud project
- The system automatically falls back to placeholder images when rate limited

### Alternative AI Services

To use a different AI provider (OpenAI DALL-E, Stability AI, etc.), modify `generateWithGemini()` in the API route:

```typescript
// Example: OpenAI DALL-E integration
const response = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "dall-e-3",
    prompt: canonicalPrompt,
    n: 1,
    size: "1024x1536", // Portrait format
    quality: "hd",
  }),
});
```

---

## Security Considerations

### Prompt Injection Prevention

The `sanitizeDesignPrompt` function removes:
- Attempts to override event title
- Attempts to inject new prompt sections
- Potentially malicious patterns

```typescript
// From posterGeneration.ts
function sanitizeDesignPrompt(prompt: string): string {
  return prompt
    .replace(/EVENT\s*(TITLE|NAME)\s*:/gi, "")
    .replace(/DESIGN\s*RULES\s*:/gi, "")
    .replace(/IMPORTANT\s*:/gi, "")
    .substring(0, 500)
    .trim();
}
```

### Rate Limiting (Recommended)

Implement rate limiting on the API endpoint:
- 10 requests per minute per user
- 100 requests per day per event

---

## Testing Checklist

- [ ] Event name is always correct and prominent
- [ ] Design prompt influences style, not identity
- [ ] Every generation produces a fresh image
- [ ] No repeated or cached posters appear
- [ ] Error states never show previous images
- [ ] Regenerate button creates completely new image
- [ ] History selection is explicit user action
- [ ] Event name auto-syncs from Step 1

---

## Expected Outcomes

After this refinement:

✅ Event name is always correct and prominent  
✅ Design prompt influences style, not identity  
✅ Every generation produces a fresh image  
✅ No repeated or cached posters  
✅ Users trust the AI instead of fighting it  
✅ Poster generation feels intentional, premium, and predictable
