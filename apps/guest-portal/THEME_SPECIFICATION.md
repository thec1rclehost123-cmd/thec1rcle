# THE C1RCLE Design System & Theme Specification

This document contains the complete design system extracted from the website for implementation in the mobile app.

## 1. Color Palette

### Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Iris / Orange** | `#F44A22` | Primary Brand Color, CTAs, Accents |
| **Iris Glow** | `#FF6B4A` | Hover states, Glow effects |
| **Iris Dim** | `#CC3311` | Active states, Darker accents |

### Base Colors (Dark Mode / Midnight)
| Name | Hex | Usage |
|------|-----|-------|
| **Base (Default)** | `#161616` | Main Background (Midnight) |
| **Base 50** | `#1F1F1F` | Lighter Backgrounds |
| **Base 100** | `#292929` | Cards, Surfaces |
| **Base 200** | `#3D3D3D` | Borders, Dividers |
| **Base 300-900** | `#525252` - `#E6E6E6` | Text hierarchy, Icons |

### Metallics & Neutrals
| Name | Hex | Usage |
|------|-----|-------|
| **Gold / Silver** | `#FEF8E8` | Highlights, Light Text |
| **Gold Light** | `#FFFFFF` | Pure White |
| **Gold Dark (Grey)** | `#E4E2E3` | Subtitles, Secondary Text |
| **Gold Metallic (Stone)** | `#A8AAAC` | Muted Text, Disabled states |

### Surface Colors (Glassmorphism)
*   **Default:** `rgba(255, 255, 255, 0.03)`
*   **Hover:** `rgba(255, 255, 255, 0.08)`
*   **Active:** `rgba(255, 255, 255, 0.12)`

## 2. Typography

### Font Families
*   **Heading / Display:** `Satoshi` (Primary), `Inter` (Fallback)
*   **Body:** `Inter`

### Font Weights
*   Light: `300`
*   Normal: `400`
*   Medium: `500`
*   Semibold: `600`
*   Bold: `700`
*   Black: `900`

## 3. Effects & Styles

### Shadows
*   **Glow:** `0 0 40px rgba(244, 74, 34, 0.3)`
*   **Glow LG:** `0 0 80px rgba(244, 74, 34, 0.45)`
*   **Card:** `0 8px 32px rgba(0, 0, 0, 0.4)`
*   **Elevate:** `0 20px 60px rgba(0, 0, 0, 0.6)`
*   **Floating:** `0 30px 100px rgba(0, 0, 0, 0.8)`
*   **Glass Inset:** `inset 0 1px 0 0 rgba(255, 255, 255, 0.1)`

### Border Radius
*   **Bubble:** `32px`
*   **Dash:** `40px`
*   **Pill:** `999px`
*   **XL:** `24px`
*   **2XL:** `32px`
*   **3XL:** `48px`

### Gradients
*   **Hero Fade:** `linear-gradient(180deg, rgba(22,22,22,0) 0%, #161616 100%)`
*   **Glass Gradient:** `linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)`
*   **Holographic:** `linear-gradient(135deg, rgba(244,74,34,0.2), rgba(254,248,232,0.2), rgba(168,170,172,0.2))`
*   **Background Gradient (Dark):**
    ```css
    radial-gradient(circle at 50% 0%, rgba(244, 74, 34, 0.15), transparent 40%),
    radial-gradient(circle at 0% 50%, rgba(244, 74, 34, 0.05), transparent 40%),
    radial-gradient(circle at 100% 50%, rgba(244, 74, 34, 0.05), transparent 40%)
    ```

## 4. UI Components & Classes

### Glass Panel (`.glass-panel`)
*   Background: `rgba(255, 255, 255, 0.03)` (Dark mode surface)
*   Backdrop Blur: `xl` (approx 24px)
*   Border: `1px solid rgba(255, 255, 255, 0.1)`
*   Shadow: `card`

### Glass Button (`.glass-button`)
*   Background: `rgba(255, 255, 255, 0.1)`
*   Backdrop Blur: `md`
*   Border: `1px solid rgba(255, 255, 255, 0.1)`
*   **Hover:** Background `rgba(255, 255, 255, 0.2)`, Shadow `glow`, Translate Y `-2px`

### Noise Texture
An SVG noise filter is applied as an overlay to the entire page (`.page-shell::before`) with `opacity: 0.05` and `mix-blend-mode: overlay`.

## 5. Animations

### Keyframes
*   **Shimmer:** Moves background position from `-1000px` to `1000px`.
*   **Float:** Translates Y up `-10px` at 50%.
*   **Pulse Glow:** Scales to `1.05` and opacity `0.8` at 50%.
*   **Tilt:** Rotates between `-1deg` and `1deg`.

### Animation Classes
*   `animate-shimmer`: `shimmer 2.5s linear infinite`
*   `animate-float`: `float 6s ease-in-out infinite`
*   `animate-pulse-glow`: `pulse-glow 3s ease-in-out infinite`
*   `animate-tilt`: `tilt 3s ease-in-out infinite`

## 6. Global Aesthetics
*   **Dark Mode First:** The design prioritizes a dark, premium aesthetic ("Midnight").
*   **Vibrant Accents:** Orange/Iris is used to create high contrast against the dark background.
*   **Depth:** Achieved through multiple layers of shadows, glassmorphism, and background blurs.
*   **Texture:** Subtle noise texture adds a premium, non-flat feel.
*   **Motion:** Constant subtle motion (floating, glowing) makes the interface feel alive.
