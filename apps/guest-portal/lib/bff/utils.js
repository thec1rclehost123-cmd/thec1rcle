export function extractItems(payload, primaryKey = "events") {
  if (Array.isArray(payload?.[primaryKey])) return payload[primaryKey];
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
