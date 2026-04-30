import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyToGatewayMock = vi.fn();

vi.mock("@/lib/server/withAuth", () => ({
    withAuth: (handler: any) => handler,
}));

vi.mock("@/lib/server/apiGateway", () => ({
    GATEWAY_URL: "http://gateway.test",
    proxyToGateway: proxyToGatewayMock,
}));

vi.mock("@/lib/server/apiResponse", () => ({
    ok: (data: any, message = "", status = 200) => ({ success: true, status, message, ...data }),
    fail: (error: string, status = 500) => ({ success: false, status, error }),
}));

function makeRequest(body: Record<string, any>) {
    return {
        json: vi.fn().mockResolvedValue(body),
        headers: {
            get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer test-token" : null,
        },
    } as any;
}

describe("POST /api/events/create", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        proxyToGatewayMock.mockResolvedValue({ success: true, status: 201 });
    });

    it("requires a title before proxying", async () => {
        const { POST } = await import("./route");
        const req = makeRequest({
            creatorRole: "venue",
        });

        const result = await POST(req, { uid: "venue-user", partnerId: "venue_1", role: "venue" });

        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
        expect(proxyToGatewayMock).not.toHaveBeenCalled();
    });

    it("requires a creatorRole before proxying", async () => {
        const { POST } = await import("./route");
        const req = makeRequest({
            title: "Missing role",
        });

        const result = await POST(req, { uid: "host-user", partnerId: "host_1", role: "host" });

        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
        expect(proxyToGatewayMock).not.toHaveBeenCalled();
    });

    it("forwards valid create requests to the unified gateway route", async () => {
        const { POST } = await import("./route");
        const body = {
            title: "Host Submit",
            creatorRole: "host",
            creatorId: "host_1",
            lifecycle: "submitted",
            venueId: "venue_1",
            venueName: "Venue One",
            startDate: "2026-04-11",
            startTime: "21:00",
            endTime: "01:00",
            host: "Host One",
        };
        const req = makeRequest(body);

        const result = await POST(req, { uid: "host-user", partnerId: "host_1", role: "host" });

        expect(result.success).toBe(true);
        expect(proxyToGatewayMock).toHaveBeenCalledOnce();
        expect(proxyToGatewayMock).toHaveBeenCalledWith(
            req,
            "http://gateway.test/api/v1/partner/events/create",
            {
                method: "POST",
                body: JSON.stringify(body),
            }
        );
    });
});
