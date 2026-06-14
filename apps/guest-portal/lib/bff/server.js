import { headers } from "next/headers";
import { guestServerJson, getApiErrorMessage } from "../api/server.js";
import { createGuestBffEnvelopeSchema } from "./contracts.js";

export const GUEST_BFF_CACHE = Object.freeze({
  PRIVATE_NO_STORE: "private-no-store",
  PUBLIC_REVALIDATED: "public-revalidated",
});

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `guest-bff-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function buildGuestBffForwardHeaders(extraHeaders = {}) {
  const incomingHeaders = await headers();
  const nextHeaders = new Headers(extraHeaders || {});

  for (const name of ["accept-language", "user-agent", "x-csrf-token", "x-request-id"]) {
    const value = incomingHeaders.get(name);
    if (value && !nextHeaders.has(name)) {
      nextHeaders.set(name, value);
    }
  }

  if (!nextHeaders.has("x-request-id")) {
    nextHeaders.set("x-request-id", createRequestId());
  }

  return nextHeaders;
}

function applyGuestBffCacheMode(options = {}) {
  const { cacheMode = GUEST_BFF_CACHE.PRIVATE_NO_STORE, ...rest } = options;
  if (rest.cache !== undefined || rest.next !== undefined) {
    return rest;
  }

  if (cacheMode === GUEST_BFF_CACHE.PUBLIC_REVALIDATED) {
    return rest;
  }

  return {
    ...rest,
    cache: "no-store",
  };
}

export async function guestBffUpstreamJson(path, options = {}) {
  const nextHeaders = await buildGuestBffForwardHeaders(options.headers);
  const requestId = nextHeaders.get("x-request-id") || createRequestId();
  const result = await guestServerJson(path, {
    ...applyGuestBffCacheMode(options),
    headers: nextHeaders,
  });

  return {
    ...result,
    requestId,
    upstreamMethod: String(options.method || "GET").toUpperCase(),
    upstreamPath: path,
  };
}

export function buildGuestBffMeta({ requestId, upstreamCalls = [], ...rest } = {}) {
  return {
    fetchedAt: new Date().toISOString(),
    requestId: requestId || createRequestId(),
    source: "bff",
    upstreamCalls,
    ...rest,
  };
}

export function buildGuestBffUpstreamTrace(...calls) {
  return calls
    .flat()
    .filter(Boolean)
    .map((call) => ({
      method: call.upstreamMethod || "GET",
      path: call.upstreamPath || "unknown",
      status: call.response?.status || 500,
    }));
}

export function buildGuestBffError(message, options = {}) {
  return {
    code: options.code,
    details: options.details,
    message,
    requestId: options.requestId,
    status: options.status,
  };
}

export function buildGuestBffResult({ status = 200, data = null, error = null, meta = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300 && !error,
    data,
    error,
    meta: buildGuestBffMeta(meta),
  };
}

export function guestBffJsonResponse(result, init = {}) {
  const {
    cacheControl,
    cacheMode,
    dataSchema,
    headers: initHeaders,
    status,
    ...restInit
  } = init;
  const envelope = result?.ok !== undefined && result?.meta
    ? {
        ok: result.ok,
        data: result.data ?? null,
        error: result.error ?? null,
        meta: result.meta,
      }
    : {
        ok: init.status ? init.status >= 200 && init.status < 300 : true,
        data: result ?? null,
        error: null,
        meta: buildGuestBffMeta(),
      };
  const validatedEnvelope = createGuestBffEnvelopeSchema(dataSchema).parse(envelope);
  const nextHeaders = new Headers(initHeaders || {});
  if (!nextHeaders.has("Cache-Control")) {
    nextHeaders.set(
      "Cache-Control",
      cacheControl ||
      (cacheMode === GUEST_BFF_CACHE.PUBLIC_REVALIDATED
        ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
        : "no-store"),
    );
  }
  return Response.json(validatedEnvelope, {
    ...restInit,
    status,
    headers: nextHeaders,
  });
}

export function getGuestBffUpstreamError(data, fallback = "Request failed") {
  return getApiErrorMessage(data, fallback);
}

export function readBooleanParam(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export function readIntegerParam(value, defaultValue = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
