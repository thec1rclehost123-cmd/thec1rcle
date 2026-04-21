import {
    callGatewayJson,
    getBearerTokenFromRequest,
    getGatewayErrorMessage,
} from "./gatewayBridge.js";

async function callGuestGateway(path, options = {}) {
    const token = options.token || await getBearerTokenFromRequest(undefined, { allowSessionCookie: true });
    const result = await callGatewayJson(path, {
        ...options,
        token,
    });

    if (!result.response.ok) {
        throw new Error(getGatewayErrorMessage(result.data));
    }

    return result.data;
}

export async function fetchGuestWallet(options = {}) {
    return callGuestGateway("/tickets", options);
}

export async function fetchGuestProfile(profileUserId, options = {}) {
    return callGuestGateway(`/guest-profiles/${encodeURIComponent(profileUserId)}`, options);
}

export async function lookupGuestUserByEmail(email, options = {}) {
    return callGuestGateway(`/guest-profiles/lookup?email=${encodeURIComponent(email)}`, options);
}

export async function fetchShareState(orderId, options = {}) {
    return callGuestGateway(`/tickets/share?orderId=${encodeURIComponent(orderId)}`, options);
}

export async function createShareBundle(payload, options = {}) {
    return callGuestGateway("/tickets/share", {
        ...options,
        method: "POST",
        body: payload,
    });
}

export async function deleteShareBundle(payload, options = {}) {
    return callGuestGateway("/tickets/share", {
        ...options,
        method: "DELETE",
        body: payload,
    });
}

export async function previewShareBundle(token, options = {}) {
    return callGuestGateway(`/tickets/claim?token=${encodeURIComponent(token)}`, options);
}

export async function claimShareBundle(token, options = {}) {
    return callGuestGateway("/tickets/claim/share", {
        ...options,
        method: "POST",
        body: { token },
    });
}

export async function previewTransfer(code, options = {}) {
    return callGuestGateway(`/transfer?code=${encodeURIComponent(code)}`, options);
}

export async function initiateTransfer(payload, options = {}) {
    return callGuestGateway("/tickets/transfer", {
        ...options,
        method: "POST",
        body: payload,
    });
}

export async function acceptTransfer(transferCode, options = {}) {
    return callGuestGateway("/tickets/transfer", {
        ...options,
        method: "PATCH",
        body: { transferCode },
    });
}

export async function cancelTransfer(transferId, options = {}) {
    return callGuestGateway("/tickets/transfer", {
        ...options,
        method: "DELETE",
        body: { transferId },
    });
}

export async function fetchPendingTransfers(options = {}) {
    return callGuestGateway("/tickets/transfer/pending", options);
}

export async function fetchPairState(params = {}, options = {}) {
    const searchParams = new URLSearchParams();
    if (params.token) searchParams.set("token", params.token);
    if (params.bundleId) searchParams.set("bundleId", params.bundleId);
    return callGuestGateway(`/tickets/pair?${searchParams.toString()}`, options);
}

export async function claimPairSlot(token, options = {}) {
    return callGuestGateway("/tickets/pair", {
        ...options,
        method: "POST",
        body: { token },
    });
}

export async function cancelPairSlot(bundleId, options = {}) {
    return callGuestGateway("/tickets/pair", {
        ...options,
        method: "DELETE",
        body: { bundleId },
    });
}

export async function createPairLink(payload, options = {}) {
    return callGuestGateway("/tickets/pair/link", {
        ...options,
        method: "POST",
        body: payload,
    });
}

export async function assignPairPartner(payload, options = {}) {
    return callGuestGateway("/tickets/pair/assign", {
        ...options,
        method: "POST",
        body: payload,
    });
}

export async function transferCoupleTicket(payload, options = {}) {
    return callGuestGateway("/tickets/pair/transfer", {
        ...options,
        method: "POST",
        body: payload,
    });
}

export async function fetchGuestNotifications(params = {}, options = {}) {
    const searchParams = new URLSearchParams();
    if (params.unreadOnly) searchParams.set("unreadOnly", "true");
    if (params.countOnly) searchParams.set("countOnly", "true");
    if (params.limit) searchParams.set("limit", String(params.limit));
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return callGuestGateway(`/guest-notifications${suffix}`, options);
}

export async function markGuestNotificationRead(notificationId, options = {}) {
    return callGuestGateway(`/guest-notifications/${encodeURIComponent(notificationId)}`, {
        ...options,
        method: "PATCH",
    });
}

export async function markAllGuestNotificationsRead(options = {}) {
    return callGuestGateway("/guest-notifications", {
        ...options,
        method: "PATCH",
        body: { markAll: true },
    });
}
