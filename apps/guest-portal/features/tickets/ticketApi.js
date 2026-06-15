'use client';

import { guestApi } from '../../lib/api/client';

async function apiFetch(request) {
  const { response, data } = await request();
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }
  return data;
}

export async function getUserTickets() {
  return apiFetch(() => guestApi.tickets.wallet());
}

export async function createShareBundle(orderId, eventId, quantity, tierId = null) {
  const result = await apiFetch(() =>
    guestApi.tickets.share({ orderId, eventId, quantity, tierId }),
  );
  return result.bundle;
}

export async function getShareBundle(token) {
  const result = await apiFetch(() => guestApi.tickets.shareBundle({ token }));
  return result?.bundle || null;
}

export async function claimTicket(token) {
  return apiFetch(() => guestApi.tickets.claimShare({ token }));
}

export async function assignPartner(ticketId, partnerUserId, metadata) {
  const result = await apiFetch(() =>
    guestApi.tickets.assignPartner({ ticketId, partnerUserId, metadata }),
  );
  return result.assignment;
}

export async function createPartnerClaimLink(ticketId, eventId) {
  return apiFetch(() => guestApi.tickets.partnerClaimLink({ ticketId, eventId }));
}

export async function claimPartnerSlot(token) {
  return apiFetch(() => guestApi.tickets.claimPartnerSlot({ token }));
}

export async function transferCoupleTicket(ticketId, newOwnerId) {
  return apiFetch(() => guestApi.tickets.transferCouple({ ticketId, newOwnerId }));
}

export async function findUserByEmail(email) {
  const result = await apiFetch(() => guestApi.profiles.lookup({ email }));
  return result.user;
}

export async function assignPartnerByEmail(ticketId, email, metadata) {
  const partner = await findUserByEmail(email);
  if (!partner) throw new Error('User not found with this email');
  return assignPartner(ticketId, partner.uid, metadata);
}

export async function initiateTransfer(ticketId, recipientEmail) {
  const result = await apiFetch(() =>
    guestApi.tickets.initiateTransfer({ ticketId, recipientEmail }),
  );
  return result.transfer;
}

export async function acceptTransfer(transferCode) {
  return apiFetch(() => guestApi.tickets.acceptTransfer({ transferCode }));
}

export async function cancelTransfer(transferId) {
  return apiFetch(() => guestApi.tickets.cancelTransfer({ transferId }));
}

function normalizeOtpRecipient(recipient) {
  const nextRecipient = String(recipient || '').trim();
  if (!nextRecipient) {
    throw new Error('An account email is required to send a security code.');
  }
  return nextRecipient;
}

export async function sendTransferOTP(recipient) {
  const nextRecipient = normalizeOtpRecipient(recipient);
  return apiFetch(() => guestApi.auth.sendOtp({ type: 'email', recipient: nextRecipient }));
}

export async function verifyAndInitiateTransfer(ticketId, recipientEmail, code, otpRecipient) {
  const nextRecipient = normalizeOtpRecipient(otpRecipient);
  await apiFetch(() => guestApi.auth.verifyOtp({ type: 'email', recipient: nextRecipient, code }));
  return initiateTransfer(ticketId, recipientEmail);
}

export async function verifyAndCreateShareBundle(
  orderId,
  eventId,
  quantity,
  tierId,
  code,
  otpRecipient,
) {
  const nextRecipient = normalizeOtpRecipient(otpRecipient);
  await apiFetch(() => guestApi.auth.verifyOtp({ type: 'email', recipient: nextRecipient, code }));
  return createShareBundle(orderId, eventId, quantity, tierId);
}
