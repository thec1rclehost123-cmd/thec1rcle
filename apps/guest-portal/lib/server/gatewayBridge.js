import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export function normalizeGatewayBaseUrl(value) {
    if (!value) return value;
    const trimmed = value.replace(/\/+$/, "");
    return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

export function getGatewayBaseUrl() {
    const baseUrl = normalizeGatewayBaseUrl(
        process.env.NEXT_PUBLIC_GATEWAY_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.PUBLIC_API_URL
    );
    if (!baseUrl) {
        throw new Error("API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL or PUBLIC_API_URL.");
    }
    return baseUrl;
}

export async function getBearerTokenFromRequest(request, { allowSessionCookie = true } = {}) {
    const authHeader = request?.headers?.get("authorization");
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

    const sessionCookie = request?.cookies?.get("__session")?.value;
    if (allowSessionCookie && sessionCookie) return sessionCookie;

    if (allowSessionCookie) {
        const cookieStore = await cookies();
        return cookieStore.get("__session")?.value || null;
    }

    return null;
}

export async function callGatewayJson(path, {
    method = "GET",
    token = null,
    body,
    requestId,
    cache = "no-store",
    headers: extraHeaders = {},
} = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...extraHeaders,
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (requestId) headers["x-request-id"] = requestId;

    const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache,
    });

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { error: { code: "BAD_GATEWAY_RESPONSE", message: text || "Gateway returned a non-JSON response" } };
    }
    return { response, data };
}

export async function proxyGatewayJson(request, path, {
    method = request.method,
    requireAuth = false,
    allowSessionCookie = true,
    body,
    headers,
} = {}) {
    const token = await getBearerTokenFromRequest(request, { allowSessionCookie });

    if (requireAuth && !token) {
        return NextResponse.json(
            { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
            { status: 401 }
        );
    }

    const requestBody = body !== undefined
        ? body
        : (method === "GET" || method === "HEAD" ? undefined : await request.json());

    const { response, data } = await callGatewayJson(path, {
        method,
        token,
        body: requestBody,
        requestId: request.headers.get("x-request-id") || undefined,
        headers,
    });

    const nextResponse = NextResponse.json(data, { status: response.status });
    const requestId = response.headers.get("x-request-id");
    if (requestId) nextResponse.headers.set("x-request-id", requestId);
    return nextResponse;
}

export function getGatewayErrorMessage(error) {
    return error?.error?.message || error?.message || error?.error || "Request failed";
}
