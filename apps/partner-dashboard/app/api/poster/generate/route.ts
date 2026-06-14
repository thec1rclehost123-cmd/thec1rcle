import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

async function handlePosterGenerate(req: NextRequest) {
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/poster/generate`, {
    method: "POST",
    body: await req.text(),
  });
}

export const POST = withAuth(handlePosterGenerate);
