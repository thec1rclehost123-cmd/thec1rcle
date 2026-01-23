/**
 * THE C1RCLE - Shared Theme Utilities
 * Provides logic for color extraction and theme normalization.
 */

/**
 * Converts RGB values to HSL.
 */
export const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
};

/**
 * Scores a color based on vibrancy and balanced lightness.
 * Returns -1 if the color is too dark, too light, or too gray.
 */
export const scoreColor = (r, g, b) => {
    const { s, l } = rgbToHsl(r, g, b);
    if (l < 0.2 || l > 0.8 || s < 0.2) return -1;
    return s * (1 - Math.abs(l - 0.5));
};

/**
 * Picks the best dominant color from an array of RGBA pixels.
 * Uses a scoring algorithm that prioritizes vibrancy and medium lightness.
 * 
 * @param {Uint8ClampedArray|Array} data - Raw RGBA pixel data [r,g,b,a, ...]
 * @param {Object} fallback - Fallback RGB color
 * @returns {Object} { r, g, b }
 */
export const pickDominantColor = (data, fallback = { r: 244, g: 74, b: 34 }) => {
    let bestColor = fallback;
    let maxScore = -1;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) continue; // Skip transparent pixels

        const score = scoreColor(r, g, b);

        if (score > maxScore) {
            maxScore = score;
            bestColor = { r, g, b };
        }
    }

    return bestColor;
};

/**
 * Formats an RGB object into various CSS/String formats.
 */
export const formatColor = {
    rgb: (color) => `rgb(${color.r}, ${color.g}, ${color.b})`,
    rgba: (color, alpha) => `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`,
    hex: (color) => `#${((1 << 24) + (color.r << 16) + (color.g << 8) + color.b).toString(16).slice(1)}`,
    values: (color) => `${color.r}, ${color.g}, ${color.b}`
};
