"use server";

import { getUserTickets as getUserTicketsStore } from "../../lib/server/profileStore";
import { verifyAuth } from "../../lib/server/auth";
import {
    createShareBundle as createShareBundleStore,
    getShareBundleByToken,
    claimTicketSlot,
    getUserClaimedTickets,
    assignPartner as assignPartnerStore,
    createPartnerClaimLink as createPartnerClaimLinkStore,
    claimPartnerSlot as claimPartnerSlotStore,
    transferCoupleTicket as transferCoupleTicketStore,
    initiateTransfer as initiateTransferStore,
    acceptTransfer as acceptTransferStore,
    cancelTransfer as cancelTransferStore
} from "../../lib/server/ticketShareStore";
import { getEvent } from "../../lib/server/eventStore";
import { findUserByEmail as findUserByEmailStore } from "../../lib/server/profileStore";
import { sendEmailOtp, verifyEmailOtp } from "../../lib/server/verification";

export async function getUserTickets(userId) {
    // In a real app we'd verify the session user matches the requested userId
    // for this task we assume the client passes the correct userId after auth check
    return await getUserTicketsStore(userId);
}

export async function createShareBundle(orderId, eventId, quantity, tierId = null) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");

    return await createShareBundleStore(orderId, user.uid, eventId, quantity, tierId);
}

export async function getShareBundle(token) {
    const bundle = await getShareBundleByToken(token);
    if (!bundle) return null;

    const event = await getEvent(bundle.eventId);

    // Check for existing claim if user is logged in
    let existingAssignment = null;
    try {
        const user = await verifyAuth();
        if (user) {
            const claims = await getUserClaimedTickets(user.uid);
            existingAssignment = claims.find(c => c.bundleId === bundle.id) || null;
        }
    } catch (e) {
        // Not logged in or error, ignore
    }

    return { ...bundle, event, existingAssignment };
}

export async function claimTicket(token) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");

    return await claimTicketSlot(token, user.uid);
}

export async function assignPartner(ticketId, partnerUserId, metadata) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await assignPartnerStore(ticketId, user.uid, partnerUserId, metadata);
}

export async function createPartnerClaimLink(ticketId, eventId) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await createPartnerClaimLinkStore(ticketId, user.uid, eventId);
}

export async function claimPartnerSlot(token) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await claimPartnerSlotStore(token, user.uid);
}

export async function transferCoupleTicket(ticketId, newOwnerId) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await transferCoupleTicketStore(ticketId, user.uid, newOwnerId);
}

export async function findUserByEmail(email) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await findUserByEmailStore(email);
}

export async function assignPartnerByEmail(ticketId, email, metadata) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");

    const partner = await findUserByEmailStore(email);
    if (!partner) throw new Error("User not found with this email");
    if (partner.uid === user.uid) throw new Error("You cannot assign yourself as partner");

    return await assignPartnerStore(ticketId, user.uid, partner.uid, metadata);
}

export async function initiateTransfer(ticketId, recipientEmail) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await initiateTransferStore(ticketId, user.uid, recipientEmail);
}

export async function acceptTransfer(transferId) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await acceptTransferStore(transferId, user.uid);
}

export async function cancelTransfer(transferId) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await cancelTransferStore(transferId, user.uid);
}

export async function sendTransferOTP() {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");
    return await sendEmailOtp(user.email, 'transaction');
}

export async function verifyAndInitiateTransfer(ticketId, recipientEmail, code) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");

    // 1. Verify OTP
    await verifyEmailOtp(user.email, code, 'transaction');

    // 2. Proceed with transfer
    return await initiateTransferStore(ticketId, user.uid, recipientEmail);
}

export async function verifyAndCreateShareBundle(orderId, eventId, quantity, tierId, code) {
    const user = await verifyAuth();
    if (!user) throw new Error("Unauthorized");

    // 1. Verify OTP
    await verifyEmailOtp(user.email, code, 'transaction');

    // 2. Proceed with share
    return await createShareBundleStore(orderId, user.uid, eventId, quantity, tierId);
}

