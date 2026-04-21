"use server";

import { verifyAuth } from "../../lib/server/auth";
import { callGatewayJson, getBearerTokenFromRequest, getGatewayErrorMessage } from "../../lib/server/gatewayBridge.js";
import {
    acceptTransfer as acceptTransferViaGateway,
    assignPairPartner,
    cancelTransfer as cancelTransferViaGateway,
    claimPairSlot,
    claimShareBundle,
    createPairLink,
    createShareBundle as createShareBundleViaGateway,
    fetchGuestWallet,
    lookupGuestUserByEmail,
    previewShareBundle,
    transferCoupleTicket as transferCoupleTicketViaGateway,
    initiateTransfer as initiateTransferViaGateway,
} from "../../lib/server/gp5GatewayBridge.js";

async function getActionToken() {
    return getBearerTokenFromRequest(undefined, { allowSessionCookie: true });
}

async function ensureUser() {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return user;
}

async function callAuthenticatedGateway(path, { method = "GET", body } = {}) {
    const token = await getActionToken();
    if (!token) throw new Error("Unauthorized");

    const { response, data } = await callGatewayJson(path, {
        method,
        token,
        body,
    });

    if (!response.ok) {
        throw new Error(getGatewayErrorMessage(data));
    }

    return data;
}

export async function getUserTickets() {
    return fetchGuestWallet();
}

export async function createShareBundle(orderId, eventId, quantity, tierId = null) {
    const bundle = await createShareBundleViaGateway({ orderId, eventId, quantity, tierId });
    return bundle.bundle;
}

export async function getShareBundle(token) {
    const preview = await previewShareBundle(token);
    return preview?.bundle || null;
}

export async function claimTicket(token) {
    return claimShareBundle(token);
}

export async function assignPartner(ticketId, partnerUserId, metadata) {
    const result = await assignPairPartner({ ticketId, partnerUserId, metadata });
    return result.assignment;
}

export async function createPartnerClaimLink(ticketId, eventId) {
    return createPairLink({ ticketId, eventId });
}

export async function claimPartnerSlot(token) {
    return claimPairSlot(token);
}

export async function transferCoupleTicket(ticketId, newOwnerId) {
    return transferCoupleTicketViaGateway({ ticketId, newOwnerId });
}

export async function findUserByEmail(email) {
    const result = await lookupGuestUserByEmail(email);
    return result.user;
}

export async function assignPartnerByEmail(ticketId, email, metadata) {
    const user = await ensureUser();
    const partner = await findUserByEmail(email);
    if (!partner) throw new Error("User not found with this email");
    if (partner.uid === user.uid) throw new Error("You cannot assign yourself as partner");

    return assignPartner(ticketId, partner.uid, metadata);
}

export async function initiateTransfer(ticketId, recipientEmail) {
    const result = await initiateTransferViaGateway({ ticketId, recipientEmail });
    return result.transfer;
}

export async function acceptTransfer(transferId) {
    return acceptTransferViaGateway(transferId);
}

export async function cancelTransfer(transferId) {
    return cancelTransferViaGateway(transferId);
}

export async function sendTransferOTP() {
    const user = await ensureUser();
    return callAuthenticatedGateway("/auth/otp/send", {
        method: "POST",
        body: {
            type: "transaction",
            recipient: user.email,
        },
    });
}

export async function verifyAndInitiateTransfer(ticketId, recipientEmail, code) {
    const user = await ensureUser();
    await callAuthenticatedGateway("/auth/otp/verify", {
        method: "POST",
        body: {
            type: "transaction",
            recipient: user.email,
            code,
        },
    });

    return initiateTransfer(ticketId, recipientEmail);
}

export async function verifyAndCreateShareBundle(orderId, eventId, quantity, tierId, code) {
    const user = await ensureUser();
    await callAuthenticatedGateway("/auth/otp/verify", {
        method: "POST",
        body: {
            type: "transaction",
            recipient: user.email,
            code,
        },
    });

    return createShareBundle(orderId, eventId, quantity, tierId);
}
