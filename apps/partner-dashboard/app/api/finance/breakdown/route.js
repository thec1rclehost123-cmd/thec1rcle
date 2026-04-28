import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { withAuth } from "@/lib/server/withAuth";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request) => {
    const { search } = new URL(request.url);
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/finance/breakdown${search}`, {});
});
