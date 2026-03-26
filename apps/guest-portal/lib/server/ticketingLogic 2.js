function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

export function isCoupleTicket(ticket = {}) {
    const entryType = String(ticket.entryType || "").toLowerCase();
    const name = String(ticket.name || "").toLowerCase();

    return Boolean(ticket.isCouple) || entryType === "couple" || name.includes("couple") || name.includes("pair");
}

export function buildStoredOrderTicket(selectedTicket = {}, eventTicket = {}) {
    const quantity = Number(selectedTicket.quantity || 0);
    const price = isFiniteNumber(selectedTicket.price)
        ? Number(selectedTicket.price)
        : Number(eventTicket.price) || 0;
    const subtotal = isFiniteNumber(selectedTicket.total ?? selectedTicket.subtotal)
        ? Number(selectedTicket.total ?? selectedTicket.subtotal)
        : price * quantity;
    const name = selectedTicket.name || eventTicket.name || "Ticket";
    const entryType = selectedTicket.entryType || eventTicket.entryType || "general";
    const genderRequirement =
        selectedTicket.genderRequirement ||
        eventTicket.genderRequirement ||
        eventTicket.gender ||
        "any";

    return {
        ticketId: eventTicket.id || selectedTicket.ticketId,
        name,
        price,
        quantity,
        subtotal,
        entryType,
        genderRequirement,
        isCouple: isCoupleTicket({
            ...eventTicket,
            ...selectedTicket,
            name,
            entryType,
        }),
    };
}

export function getBundleInventoryMode(order = null) {
    return order?.isRSVP ? "claim_based" : "precommitted";
}

export function shouldReduceInventoryOnBundleCreation(inventoryMode, hasOwnerClaimed) {
    return inventoryMode === "claim_based" && hasOwnerClaimed;
}

export function shouldReduceInventoryOnBundleClaim(inventoryMode) {
    return inventoryMode === "claim_based";
}

export function parseDirectTicketId(ticketId) {
    const parts = String(ticketId || "").split("-");
    if (parts.length < 3) {
        throw new Error("Invalid ticket reference");
    }

    const slotIndex = Number(parts[parts.length - 1]);
    if (!Number.isInteger(slotIndex) || slotIndex < 1) {
        throw new Error("Invalid ticket reference");
    }

    return {
        orderId: parts.slice(0, parts.length - 2).join("-"),
        tierId: parts[parts.length - 2],
        slotIndex,
    };
}

export function deriveDirectTransferMetadata(ticketId, order, event = null) {
    const parsed = parseDirectTicketId(ticketId);
    const sourceTicket = order?.tickets?.find((ticket) => ticket.ticketId === parsed.tierId);

    if (!sourceTicket) {
        throw new Error("Ticket not found in order");
    }

    if (isCoupleTicket(sourceTicket)) {
        throw new Error("Couple entries must be managed through the couple ticket flow.");
    }

    const eventTicket = event?.tickets?.find((ticket) => ticket.id === parsed.tierId) || null;

    return {
        orderId: parsed.orderId,
        tierId: parsed.tierId,
        slotIndex: parsed.slotIndex,
        ticketType: sourceTicket.name || eventTicket?.name || "Ticket",
        requiredGender:
            sourceTicket.genderRequirement ||
            eventTicket?.genderRequirement ||
            eventTicket?.gender ||
            "any",
    };
}
