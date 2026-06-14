import { beforeEach, describe, expect, it, vi } from "vitest";

const requireHostAccessMock = vi.fn();
const proxyToGatewayMock = vi.fn();

vi.mock("@/lib/server/hostAuthMiddleware", () => ({
    requireHostAccess: requireHostAccessMock,
}));

vi.mock("@/lib/server/apiResponse", () => ({
    ok: (data: any, message = "", status = 200) => ({ success: true, status, message, ...data }),
    fail: (error: string, status = 500) => ({ success: false, status, error }),
}));

vi.mock("@/lib/server/apiGateway", () => ({
    GATEWAY_URL: "http://gateway.test",
    proxyToGateway: proxyToGatewayMock,
}));

function makeRequest() {
    return {
        json: vi.fn().mockResolvedValue({ hostNote: "Please review" }),
        headers: {
            get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer test-token" : null,
        },
    } as any;
}

describe("POST /api/host/events/[id]/submit", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        requireHostAccessMock.mockResolvedValue({ uid: "user_1", hostId: "host_1" });
        proxyToGatewayMock.mockResolvedValue({ success: true, status: 200 });
    });

    it("forwards host submissions to the gateway with the resolved hostId", async () => {
        const { POST } = await import("./route");
        const req = makeRequest();

        const result = await POST(req, { params: Promise.resolve({ id: "evt_1" }) });

        expect((result as any).success).toBe(true);
        expect(requireHostAccessMock).toHaveBeenCalledWith(req, "MANAGE_EVENTS");
        expect(proxyToGatewayMock).toHaveBeenCalledWith(
            req,
            "http://gateway.test/api/v1/partners/hosts/events/evt_1/submit",
            {
                method: "POST",
                body: JSON.stringify({
                    hostId: "host_1",
                    hostNote: "Please review",
                }),
            }
        );
    });
});
