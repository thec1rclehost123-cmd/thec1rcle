import sharp from 'sharp';
import { getAdminDb } from './admin.js';

const isUsableColor = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const saturation = max === 0 ? 0 : (max - min) / max;

  // Ignore near-black poster backgrounds
  if (brightness < 35) return false;

  // Ignore white headings and bright text
  if (brightness > 230) return false;

  // Ignore grays
  if (saturation < 0.22) return false;

  return true;
};

const quantize = (value, step = 32) =>
  Math.min(255, Math.floor(value / step) * step);

export async function extractDominantColorFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return extractDominantColorFromBuffer(buffer);
  } catch {
    return null;
  }
}

export async function extractDominantColorFromBuffer(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colorCounts = new Map();

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (!isUsableColor(r, g, b)) continue;

    const qr = quantize(r);
    const qg = quantize(g);
    const qb = quantize(b);

    const key = `${qr},${qg},${qb}`;

    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }

  if (!colorCounts.size) {
    return '#F44A22';
  }

  const [topColor] = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  const [r, g, b] = topColor.split(',').map(Number);

  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Darken a hex color by a given amount (0–1).
 * Used to produce a safe full-screen background from a saturated dominant color.
 */
export function darkenHex(hex, amount = 0.32) {
  const value = hex.replace('#', '');
  if (value.length < 6) return hex;
  try {
    const channels = [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ].map((channel) => Math.round(channel * (1 - amount)));
    return `#${channels
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`;
  } catch {
    return hex;
  }
}

function getReadableTextColor(color) {
  const hex = color.replace('#', '');
  try {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.48 ? '#161616' : '#FFFFFF';
  } catch {
    return '#FFFFFF';
  }
}

/**
 * Full pipeline: extract dominant color from poster URL and save expanded
 * color palette on the event document.
 *
 * Firestore saved fields:
 *   dominantColor   – raw extracted dominant color
 *   accentColor     – same as dominantColor (for borders, buttons, glows, chips)
 *   backgroundColor – darkened version safe for full-screen backgrounds
 *   textColor       – black or white chosen for contrast against backgroundColor
 *   posterColorExtractedAt – timestamp
 */
export async function extractAndSaveEventDominantColor(eventId, posterUrl) {
  if (!eventId || !posterUrl) return;
  try {
    const response = await fetch(posterUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return;
    const buffer = Buffer.from(await response.arrayBuffer());

    const hex = await extractDominantColorFromBuffer(buffer);
    if (!hex) return;

    const backgroundColor = darkenHex(hex);
    const textColor = getReadableTextColor(backgroundColor);

    const db = getAdminDb();
    await db.collection('events').doc(eventId).update({
      dominantColor: hex,
      accentColor: hex,
      backgroundColor,
      textColor,
      posterColorExtractedAt: new Date().toISOString(),
    });
  } catch {
    // Non-critical — extraction is best-effort
  }
}
