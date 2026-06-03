export type UploadLike = {
  name: string;
  size: number;
  type: string;
};

export type UploadValidationRule = {
  label: string;
  maxBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
};

export const HOST_VERIFICATION_UPLOAD_RULES = {
  idDocument: {
    label: "Government ID",
    maxBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
  },
  instaScreenshot: {
    label: "Instagram screenshot",
    maxBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  },
} satisfies Record<string, UploadValidationRule>;

function formatMegabytes(bytes: number) {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}

export function sanitizeUploadFilename(fileName: string) {
  const normalized = String(fileName || "upload")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return normalized || "upload";
}

export function validateClientUpload(file: UploadLike | null | undefined, rule: UploadValidationRule): string | null {
  if (!file) {
    return `${rule.label} is required.`;
  }

  const normalizedName = String(file.name || "").toLowerCase();
  const hasAllowedExtension = rule.allowedExtensions.some((extension) => normalizedName.endsWith(extension));
  const hasAllowedMimeType = rule.allowedMimeTypes.includes(String(file.type || "").toLowerCase());

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    return `${rule.label} must be one of: ${rule.allowedExtensions.join(", ")}.`;
  }

  if (Number(file.size || 0) > rule.maxBytes) {
    return `${rule.label} must be smaller than ${formatMegabytes(rule.maxBytes)}.`;
  }

  return null;
}
