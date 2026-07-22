import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVenueAccessMock = vi.fn();
const requireHostAccessMock = vi.fn();
const proxyToGatewayMock = vi.fn();
const resolveVenuePartnerRouteGuardMock = vi.fn();
const validateVenuePartnerRouteGuardMock = vi.fn();
const getHostSettingsMock = vi.fn();
const getLoginSessionsMock = vi.fn();
const revokeLoginSessionMock = vi.fn();
const revokeOtherLoginSessionsMock = vi.fn();
const updateHostSettingsMock = vi.fn();
const writeLoginSessionMock = vi.fn();

vi.mock("@/lib/rbac/staffProfileEnforcer", () => ({
  requireVenueAccess: requireVenueAccessMock,
}));

vi.mock("@/lib/server/hostAuthMiddleware", () => ({
  requireHostAccess: requireHostAccessMock,
}));

vi.mock("@/lib/server/hostSettingsStore", () => ({
  getHostSettings: getHostSettingsMock,
  getLoginSessions: getLoginSessionsMock,
  revokeLoginSession: revokeLoginSessionMock,
  revokeOtherLoginSessions: revokeOtherLoginSessionsMock,
  updateHostSettings: updateHostSettingsMock,
  writeLoginSession: writeLoginSessionMock,
}));

vi.mock("@/lib/session/hostSession", () => ({
  HOST_SESSION_HEADER: "x-host-session-id",
  readHostSessionIdFromCookieHeader: () => "host-session-1",
}));

vi.mock("@/lib/server/apiGateway", () => ({
  GATEWAY_URL: "http://gateway.test",
  proxyToGateway: proxyToGatewayMock,
}));

vi.mock("@/lib/server/partnerRouteGuards", () => ({
  resolveVenuePartnerRouteGuard: resolveVenuePartnerRouteGuardMock,
  validateVenuePartnerRouteGuard: validateVenuePartnerRouteGuardMock,
}));

function makeRequest(url: string, method = "GET") {
  const headerMap = new Map<string, string>([
    ["authorization", "Bearer test-token"],
    ["x-request-id", "req_123"],
    ["cookie", "pd_host_session_id=host-session-1"],
  ]);

  return {
    url,
    method,
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    text: vi.fn().mockResolvedValue(""),
  } as any;
}

describe("/api/partners/[...path] route guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireVenueAccessMock.mockResolvedValue({
      uid: "user_1",
      venueId: "venue_1",
      membershipId: "member_1",
      baseRole: "STAFF",
      piiPolicy: {
        showPhone: false,
        showEmail: false,
        showLastName: false,
        showOrderAmount: false,
        showPayoutAmounts: false,
      },
      guestlistScope: "editable",
      eventScope: ["evt_1"],
      canDo: () => true,
    });
    requireHostAccessMock.mockResolvedValue({
      uid: "host-user-1",
      hostId: "host_1",
      role: "OWNER",
      membershipId: "host_member_1",
      displayName: "Host Owner",
      piiPolicy: {
        showPhone: true,
        showEmail: true,
        showLastName: true,
      },
    });
    resolveVenuePartnerRouteGuardMock.mockImplementation((segments) => {
      if (segments[1] === "guest-ops") {
        return {
          partnerType: "venue",
          requiredAction: "guestlist:read",
          eventId: segments[2],
          requiresEventScope: true,
        };
      }

      return null;
    });
    validateVenuePartnerRouteGuardMock.mockReturnValue(null);
    proxyToGatewayMock.mockResolvedValue({ success: true, status: 200 });
    getHostSettingsMock.mockResolvedValue({ hostId: "host_1", orgName: "Host One" });
    getLoginSessionsMock.mockResolvedValue([{ sessionId: "host-session-1" }]);
    updateHostSettingsMock.mockResolvedValue({ hostId: "host_1", orgName: "Updated Host" });
    writeLoginSessionMock.mockResolvedValue({ sessionId: "host-session-1" });
  });

  it("proxies allowed venue guest-ops reads", async () => {
    const { GET } = await import("./route");
    const req = makeRequest("http://app.test/api/partners/venues/guest-ops/evt_1/guests?venueId=venue_1");

    const result = await GET(req, { params: Promise.resolve({ path: ["venues", "guest-ops", "evt_1", "guests"] }) });

    expect(result).toEqual({ success: true, status: 200 });
    expect(requireVenueAccessMock).toHaveBeenCalledWith(req, "guestlist:read");
    expect(proxyToGatewayMock).toHaveBeenCalled();
  });

  it("blocks out-of-scope guest-ops reads before proxying", async () => {
    const { GET } = await import("./route");
    const req = makeRequest("http://app.test/api/partners/venues/guest-ops/evt_2/guests?venueId=venue_1");
    validateVenuePartnerRouteGuardMock.mockReturnValue({
      status: 403,
      message: "This venue staff profile is not allowed to access the requested event.",
    });

    const response = await GET(req, { params: Promise.resolve({ path: ["venues", "guest-ops", "evt_2", "guests"] }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
      },
    });
    expect(proxyToGatewayMock).not.toHaveBeenCalled();
  });

  it("blocks read-only guestlist profiles from mutating guest records", async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: "user_1",
      venueId: "venue_1",
      membershipId: "member_1",
      baseRole: "STAFF",
      piiPolicy: {
        showPhone: false,
        showEmail: false,
        showLastName: false,
        showOrderAmount: false,
        showPayoutAmounts: false,
      },
      guestlistScope: "read_only",
      eventScope: ["evt_1"],
      canDo: () => true,
    });

    const { POST } = await import("./route");
    const req = makeRequest("http://app.test/api/partners/venues/guest-ops/evt_1/guests?venueId=venue_1", "POST");
    resolveVenuePartnerRouteGuardMock.mockReturnValue({
      partnerType: "venue",
      requiredAction: "guestlist:add_guest",
      eventId: "evt_1",
      requiresEditableGuestlist: true,
      requiresEventScope: true,
    });
    validateVenuePartnerRouteGuardMock.mockReturnValue({
      status: 403,
      message: "This venue staff profile does not have editable guestlist access.",
    });

    const response = await POST(req, { params: Promise.resolve({ path: ["venues", "guest-ops", "evt_1", "guests"] }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
    expect(proxyToGatewayMock).not.toHaveBeenCalled();
  });

  it("enforces host access before proxying unified host routes", async () => {
    const { GET } = await import("./route");
    const req = makeRequest("http://app.test/api/partners/hosts/overview?range=1m&metric=tickets");

    const result = await GET(req, { params: Promise.resolve({ path: ["hosts", "overview"] }) });

    expect(requireHostAccessMock).toHaveBeenCalledWith(req);
    expect(result).toEqual({ success: true, status: 200 });
    expect(proxyToGatewayMock).toHaveBeenCalled();
  });

  it("serves host settings locally on the unified host settings route", async () => {
    const { GET } = await import("./route");
    const req = makeRequest("http://app.test/api/partners/hosts/settings?include=sessions");

    const response = await GET(req, { params: Promise.resolve({ path: ["hosts", "settings"] }) });

    expect(requireHostAccessMock).toHaveBeenCalledWith(req, undefined, undefined, { allowMissingSession: false });
    await expect(response.json()).resolves.toMatchObject({
      settings: { orgName: "Host One" },
      sessions: [{ sessionId: "host-session-1" }],
    });
    expect(proxyToGatewayMock).not.toHaveBeenCalled();
  });

  it("allows host session bootstrap writes without a prior session", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("http://app.test/api/partners/hosts/settings", "POST");
    req.text.mockResolvedValue(JSON.stringify({
      action: "WRITE_SESSION",
      sessionData: {
        sessionId: "host-session-1",
        userAgent: "Mozilla/5.0",
        deviceType: "desktop",
        lastActiveAt: "2026-05-01T00:00:00.000Z",
      },
    }));

    const response = await POST(req, { params: Promise.resolve({ path: ["hosts", "settings"] }) });

    expect(requireHostAccessMock).toHaveBeenCalledWith(req, undefined, undefined, { allowMissingSession: true });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      session: { sessionId: "host-session-1" },
    });
    expect(writeLoginSessionMock).toHaveBeenCalled();
    expect(proxyToGatewayMock).not.toHaveBeenCalled();
  });
});
