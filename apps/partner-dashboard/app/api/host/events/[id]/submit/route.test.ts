import { beforeEach, describe, expect, it, vi } from "vitest";

const requireHostAccessMock = vi.fn();
const writeAuditLogMock = vi.fn();
const checkPartnershipMock = vi.fn();
const createSlotRequestMock = vi.fn();
const listSlotRequestsMock = vi.fn();
const loggerErrorMock = vi.fn();

const eventUpdateMock = vi.fn();
const submissionHistoryAddMock = vi.fn();
const notificationsAddMock = vi.fn();

vi.mock("@/lib/server/hostAuthMiddleware", () => ({
    requireHostAccess: requireHostAccessMock,
    writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/lib/server/partnershipStore", () => ({
    checkPartnership: checkPartnershipMock,
}));

vi.mock("@/lib/server/slotStore", () => ({
    createSlotRequest: createSlotRequestMock,
    listSlotRequests: listSlotRequestsMock,
}));

vi.mock("@/lib/server/apiResponse", () => ({
    ok: (data: any, message = "", status = 200) => ({ success: true, status, message, ...data }),
    fail: (error: string, status = 500) => ({ success: false, status, error }),
}));

vi.mock("@/lib/server/logger", () => ({
    logger: { error: loggerErrorMock },
}));

vi.mock("@/lib/firebase/admin", () => ({
    getAdminDb: () => ({
        collection(name: string) {
            if (name === "events") {
                return {
                    doc() {
                        return {
                            get: async () => ({
                                exists: true,
                                data: () => ({
                                    title: "Host Submit",
                                    hostId: "host_1",
                                    creatorId: "host_1",
                                    venueId: "venue_1",
                                    venueName: "Venue One",
                                    startDate: "2026-04-11",
                                    startTime: "21:00",
                                    endTime: "01:00",
                                    lifecycle: "draft",
                                    ticketTiers: [{ id: "ga" }],
                                    coverImage: "/poster.png",
                                }),
                            }),
                            update: eventUpdateMock,
                            collection() {
                                return { add: submissionHistoryAddMock };
                            },
                        };
                    },
                };
            }

            if (name === "notifications") {
                return { add: notificationsAddMock };
            }

            throw new Error(`Unexpected collection ${name}`);
        },
    }),
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
        checkPartnershipMock.mockResolvedValue(true);
        listSlotRequestsMock.mockResolvedValue([]);
        createSlotRequestMock.mockResolvedValue({ id: "slot_1" });
    });

    it("creates a slot request and transitions the event to submitted", async () => {
        const { POST } = await import("./route");

        const result = await POST(makeRequest(), { params: Promise.resolve({ id: "evt_1" }) });

        expect(result.success).toBe(true);
        expect(checkPartnershipMock).toHaveBeenCalledWith("host_1", "venue_1");
        expect(createSlotRequestMock).toHaveBeenCalledOnce();
        expect(eventUpdateMock).toHaveBeenCalledOnce();
        expect(submissionHistoryAddMock).toHaveBeenCalledOnce();
        expect(notificationsAddMock).toHaveBeenCalledOnce();
    });
});
