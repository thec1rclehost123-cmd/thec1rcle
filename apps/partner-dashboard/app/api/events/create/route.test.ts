import { beforeEach, describe, expect, it, vi } from "vitest";

const createEventMock = vi.fn();
const createSlotRequestMock = vi.fn();
const getDateAvailabilityMock = vi.fn();
const isSlotAvailableMock = vi.fn();
const checkPartnershipMock = vi.fn();
const resolveHostVenueSelectionMock = vi.fn();

vi.mock("@/lib/server/eventStore", () => ({
    createEvent: createEventMock,
}));

vi.mock("@/lib/server/slotStore", () => ({
    createSlotRequest: createSlotRequestMock,
}));

vi.mock("@/lib/server/calendarStore", () => ({
    getDateAvailability: getDateAvailabilityMock,
    isSlotAvailable: isSlotAvailableMock,
}));

vi.mock("@/lib/server/partnershipStore", () => ({
    checkPartnership: checkPartnershipMock,
    resolveHostVenueSelection: resolveHostVenueSelectionMock,
}));

vi.mock("@/lib/server/withAuth", () => ({
    withAuth: (handler: any) => handler,
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
        getDateAvailabilityMock.mockResolvedValue({ status: "available", slots: [] });
        isSlotAvailableMock.mockResolvedValue(true);
        checkPartnershipMock.mockResolvedValue(true);
        resolveHostVenueSelectionMock.mockImplementation(async (_hostId: string, venueId: string, venueName = "") => ({
            venueId,
            venueName,
            canonicalized: false,
        }));
        createEventMock.mockImplementation(async (payload: any) => ({ id: "evt_1", ...payload }));
        createSlotRequestMock.mockResolvedValue({ id: "slot_1" });
    });

    it("allows venue direct create without slot request side effects", async () => {
        const { POST } = await import("./route");
        const req = makeRequest({
            title: "Venue Night",
            creatorRole: "venue",
            lifecycle: "scheduled",
            venueId: "venue_1",
            startDate: "2026-04-11",
            startTime: "21:00",
            endTime: "01:00",
        });

        const result = await POST(req, { uid: "venue-user", partnerId: "venue_1", role: "venue" });

        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
        expect(createEventMock).toHaveBeenCalledOnce();
        expect(createSlotRequestMock).not.toHaveBeenCalled();
        expect(checkPartnershipMock).not.toHaveBeenCalled();
    });

    it("keeps host drafts side-effect free", async () => {
        const { POST } = await import("./route");
        const req = makeRequest({
            title: "Host Draft",
            creatorRole: "host",
            creatorId: "host_1",
            lifecycle: "draft",
            venueId: "venue_1",
            startDate: "2026-04-11",
            startTime: "21:00",
            endTime: "01:00",
        });

        const result = await POST(req, { uid: "host-user", partnerId: "host_1", role: "host" });

        expect(result.success).toBe(true);
        expect(createEventMock).toHaveBeenCalledOnce();
        expect(createSlotRequestMock).not.toHaveBeenCalled();
        expect(checkPartnershipMock).not.toHaveBeenCalled();
    });

    it("does not block draft creation on unavailable venue slots", async () => {
        getDateAvailabilityMock.mockResolvedValue({ status: "available", slots: [] });
        isSlotAvailableMock.mockResolvedValue(false);

        const { POST } = await import("./route");
        const req = makeRequest({
            title: "Host Draft With Conflict",
            creatorRole: "host",
            creatorId: "host_1",
            lifecycle: "draft",
            venueId: "venue_1",
            startDate: "2026-04-11",
            startTime: "21:00",
            endTime: "01:00",
        });

        const result = await POST(req, { uid: "host-user", partnerId: "host_1", role: "host" });

        expect(result.success).toBe(true);
        expect(createEventMock).toHaveBeenCalledOnce();
        expect(isSlotAvailableMock).not.toHaveBeenCalled();
        expect(createSlotRequestMock).not.toHaveBeenCalled();
    });

    it("requires partnership and creates a slot request for host submit", async () => {
        const { POST } = await import("./route");
        const req = makeRequest({
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
        });

        const result = await POST(req, { uid: "host-user", partnerId: "host_1", role: "host" });

        expect(result.success).toBe(true);
        expect(checkPartnershipMock).toHaveBeenCalledWith("host_1", "venue_1");
        expect(createSlotRequestMock).toHaveBeenCalledOnce();
    });
});
