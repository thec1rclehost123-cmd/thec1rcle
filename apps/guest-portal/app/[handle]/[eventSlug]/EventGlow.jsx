"use client";
import { useState, useEffect } from "react";

const _cache = {};

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
}

function useDominantColor(imageUrl) {
    const [color, setColor] = useState(() => (imageUrl && _cache[imageUrl]) || null);

    useEffect(() => {
        if (!imageUrl) return;
        if (_cache[imageUrl]) { setColor(_cache[imageUrl]); return; }

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 40; canvas.height = 40;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, 40, 40);
                const data = ctx.getImageData(0, 0, 40, 40).data;

                let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    if (a < 128) continue;
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const sat = max === 0 ? 0 : (max - min) / max;
                    const w = 0.3 + sat * 0.7;
                    rTotal += r * w; gTotal += g * w; bTotal += b * w; count += w;
                }
                if (count === 0) return;

                let r = Math.round(rTotal / count);
                let g = Math.round(gTotal / count);
                let b = Math.round(bTotal / count);

                // Clamp: cap saturation + lightness so dark posters still glow well
                const [h, s, l] = rgbToHsl(r, g, b);
                const cs = Math.max(Math.min(s, 72), 35); // floor sat so grey posters still get color
                const cl = Math.min(Math.max(l, 28), 52);
                const [cr, cg, cb] = hslToRgb(h, cs, cl);

                const result = `${cr}, ${cg}, ${cb}`;
                _cache[imageUrl] = result;
                setColor(result);
            } catch { /* canvas tainted, keep fallback */ }
        };
    }, [imageUrl]);

    return color;
}

/**
 * Renders layered atmospheric glow derived from the poster's dominant color.
 * Uses position:fixed so it sits at the viewport level, independent of any
 * overflow-hidden ancestors. pointer-events:none so it never blocks interaction.
 */
export default function EventGlow({ posterUrl }) {
    const color = useDominantColor(posterUrl);

    // Fallback to a deep violet while color is extracting
    const c = color || "109, 40, 217";

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none"
            style={{ position: "fixed", inset: 0, zIndex: 0 }}
        >
            {/* Base dark floor */}
            <div style={{ position: "absolute", inset: 0, background: "#050508" }} />

            {/* Primary bloom — top-center, large ellipse, most saturated */}
            <div style={{
                position: "absolute",
                top: "-15%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "130vw",
                height: "90vh",
                background: `radial-gradient(ellipse at 50% 0%, rgba(${c},0.38) 0%, rgba(${c},0.14) 40%, transparent 68%)`,
                filter: "blur(2px)",
            }} />

            {/* Secondary bloom — mid page, softer fill */}
            <div style={{
                position: "absolute",
                top: "30%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "100vw",
                height: "70vh",
                background: `radial-gradient(ellipse at 50% 40%, rgba(${c},0.14) 0%, rgba(${c},0.04) 55%, transparent 72%)`,
            }} />

            {/* Accent bloom — bottom, faint warmth so the page doesn't die */}
            <div style={{
                position: "absolute",
                bottom: "-5%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "80vw",
                height: "50vh",
                background: `radial-gradient(ellipse at 50% 100%, rgba(${c},0.12) 0%, transparent 65%)`,
            }} />

            {/* Grain texture for cinematic depth */}
            <div style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
                backgroundSize: "200px 200px",
                opacity: 0.025,
                mixBlendMode: "overlay",
            }} />
        </div>
    );
}
