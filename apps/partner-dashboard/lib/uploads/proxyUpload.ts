type ProxyUploadOptions = {
  endpoint: string;
  file: File;
  token?: string | null;
  fields?: Record<string, string | number | boolean | null | undefined>;
};

type PartnerUploadTarget = {
  partnerId?: string | null;
  partnerType?: string | null;
  entityType?: string | null;
};

function extractUploadErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error?.message) return payload.error.message;
  if (payload.message) return payload.message;
  return fallback;
}

export async function uploadFileViaProxy({
  endpoint,
  file,
  token,
  fields,
}: ProxyUploadOptions): Promise<{ url: string; filename?: string; [key: string]: any }> {
  const formData = new FormData();
  formData.append('file', file);

  for (const [key, value] of Object.entries(fields || {})) {
    if (value === undefined || value === null) continue;
    formData.append(key, String(value));
  }

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractUploadErrorMessage(payload, 'Upload failed'));
  }

  const url = payload?.url || payload?.data?.url;
  if (!url) {
    throw new Error('Upload succeeded without returning a file URL');
  }

  return {
    ...(payload || {}),
    url,
    filename: payload?.filename || payload?.fileName || file.name,
  };
}

export function buildPartnerUploadEndpoint(target: PartnerUploadTarget) {
  const partnerId = target.partnerId || null;
  const rawType = (target.partnerType || target.entityType || "").toLowerCase();
  const partnerType = rawType === "club" ? "venue" : rawType;

  if (!partnerId) {
    throw new Error("Missing active partner id for upload.");
  }
  if (partnerType === "host") {
    return `/api/partners/hosts/upload?hostId=${partnerId}`;
  }
  if (partnerType === "venue") {
    return `/api/venue/upload?venueId=${partnerId}`;
  }

  throw new Error(`Unsupported partner upload type: ${partnerType || "unknown"}`);
}
