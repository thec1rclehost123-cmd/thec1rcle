export function parseGuestTicketPayload(ticketPayload) {
    if (!ticketPayload || typeof ticketPayload !== "string" || ticketPayload.length > 512) {
        return { kind: "invalid", reason: "malformed_payload" };
    }

    try {
        const parsed = JSON.parse(ticketPayload);
        if (parsed?.eid) return { kind: "entitlement", payload: parsed };
        if (parsed?.o || parsed?.e) return { kind: "signed_json", payload: parsed };
    } catch {
        // Legacy payloads are colon-delimited strings.
    }

    const parts = ticketPayload.split(":");
    if (parts.length < 2 || parts.some((part) => !part)) {
        return { kind: "invalid", reason: "malformed_legacy_payload" };
    }

    return {
        kind: "legacy",
        ticketId: parts[0],
        signature: parts[parts.length - 1],
        parts,
    };
}

export function buildGuestScanDecision({ approved = false, ticket = null, reason = null, message = null } = {}) {
    return {
        status: approved ? "approved" : "denied",
        ...(ticket && { ticket }),
        ...(reason && { reason }),
        message: message || (approved ? "Entry Granted" : "Access Denied"),
    };
}
