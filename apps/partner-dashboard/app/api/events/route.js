import { NextResponse } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "../../../lib/server/apiGateway";

export async function GET(request) {
  return proxyToGateway(request, `${GATEWAY_URL}/api/v1/events?${new URL(request.url).searchParams.toString()}`, {});
}
