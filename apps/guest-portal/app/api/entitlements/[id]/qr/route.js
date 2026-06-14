/**
 * THE C1RCLE - Entitlement QR API (BFF Proxy)
 * Delegates to API Gateway for QR code generation
 */
import { verifyAuth } from "@/lib/server/auth";
import { generateEntitlementQR } from "@c1rcle/core/entitlement-engine";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

export async function GET(request, { params }) {
  if (!GATEWAY_URL) return Response.json({ error: "Service unavailable" }, { status: 503 });
  const user = await verifyAuth(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${GATEWAY_URL}/api/v1/scan/entitlements/${params.id}/qr`, {
    headers: { Authorization: request.headers.get("Authorization") || "" },
  });
  return Response.json(await res.json().catch(() => ({})), { status: res.status });
}
