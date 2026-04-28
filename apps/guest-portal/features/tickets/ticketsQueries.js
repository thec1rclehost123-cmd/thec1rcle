"use client";

import { useQuery } from "@tanstack/react-query";
import { guestApi, getApiErrorMessage } from "../../lib/api/client";

const CACHE_TTL_MS = 2 * 60 * 1000;
const TICKETS_ROOT_QUERY_KEY = ["guest", "tickets"];

export const EMPTY_TICKETS = Object.freeze({
  upcomingTickets: [],
  pastTickets: [],
  actionNeeded: [],
  cancelledTickets: [],
  coverWalletsByOrder: {},
});

export function ticketsWalletQueryKey(uid) {
  return [...TICKETS_ROOT_QUERY_KEY, "wallet", uid || "anonymous"];
}

export function ticketDetailQueryKey(uid, ticketId) {
  return [...TICKETS_ROOT_QUERY_KEY, "detail", uid || "anonymous", ticketId];
}

function groupTickets(list = []) {
  const groups = {};
  list.forEach((ticket) => {
    const key = ticket.orderId || ticket.eventId || ticket.id;
    if (!groups[key]) {
      groups[key] = { ...ticket, isGroup: true, tickets: [] };
    }
    groups[key].tickets.push(ticket);
  });
  return Object.values(groups);
}

export function normalizeTicketsWallet(data = {}) {
  return {
    upcomingTickets: groupTickets(data.upcomingTickets || []),
    pastTickets: groupTickets(data.pastTickets || []),
    actionNeeded: data.actionNeeded || [],
    cancelledTickets: data.cancelledTickets || [],
    coverWalletsByOrder: data.coverWalletsByOrder || {},
  };
}

export async function fetchTicketsWallet() {
  const { response, data } = await guestApi.tickets.wallet();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to load tickets"));
  }
  return normalizeTicketsWallet(data);
}

export function useTicketsWalletQuery(uid, options = {}) {
  return useQuery({
    queryKey: ticketsWalletQueryKey(uid),
    queryFn: fetchTicketsWallet,
    enabled: Boolean(uid) && options.enabled !== false,
    staleTime: CACHE_TTL_MS,
    ...options,
  });
}

export async function fetchTicketDetail(ticketId) {
  const { response, data } = await guestApi.tickets.get(ticketId);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to load ticket"));
  }
  return data.ticket;
}

export function useTicketDetailQuery(uid, ticketId, options = {}) {
  return useQuery({
    queryKey: ticketDetailQueryKey(uid, ticketId),
    queryFn: () => fetchTicketDetail(ticketId),
    enabled: Boolean(uid) && Boolean(ticketId) && options.enabled !== false,
    staleTime: 30 * 1000, // Refresh QR more frequently
    refetchInterval: 60 * 1000, // Auto-rotate signature if engine supports it
    ...options,
  });
}

export async function invalidateTicketsQueries(queryClient, uid) {
  await queryClient.invalidateQueries({ queryKey: ticketsWalletQueryKey(uid) });
}
