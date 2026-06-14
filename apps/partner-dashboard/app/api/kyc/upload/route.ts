import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { withAuth } from "@/lib/server/withAuth";

export const POST = withAuth(async (req: NextRequest) => {
    const formData = await req.formData();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/kyc/upload`, {
        method: "POST",
        body: formData,
    });
});
