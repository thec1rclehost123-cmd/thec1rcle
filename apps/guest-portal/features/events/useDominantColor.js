'use client';

import { useEffect, useState } from 'react';

const colorCache = {};

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function clampColor(r, g, b) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.min(s, 70);
  l = Math.min(l, 55);
  const [cr, cg, cb] = hslToRgb(h, s, l);
  return `${cr}, ${cg}, ${cb}`;
}

export function useDominantColor(imageUrl) {
  const [color, setColor] = useState(() => (imageUrl && colorCache[imageUrl]) || null);

  useEffect(() => {
    if (!imageUrl) return;
    if (colorCache[imageUrl]) {
      setColor(colorCache[imageUrl]);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;

        let rTotal = 0;
        let gTotal = 0;
        let bTotal = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const weight = 0.3 + saturation * 0.7;
          rTotal += r * weight;
          gTotal += g * weight;
          bTotal += b * weight;
          count += weight;
        }

        if (count > 0) {
          const result = clampColor(
            Math.round(rTotal / count),
            Math.round(gTotal / count),
            Math.round(bTotal / count),
          );
          colorCache[imageUrl] = result;
          setColor(result);
        }
      } catch {
        setColor('244, 74, 34');
      }
    };
    img.onerror = () => setColor('244, 74, 34');
  }, [imageUrl]);

  return color || '244, 74, 34';
}
