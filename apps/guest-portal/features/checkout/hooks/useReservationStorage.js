'use client';

import { useCallback, useEffect, useState } from 'react';
import { hydrateReservationItems, normalizeReservationItems } from '../utils/checkoutViewModel';

export const RESERVATION_STORAGE_KEY = 'c1rcle_reservation';
export const RESERVATION_SYNC_EVENT_KEY = 'c1rcle_reservation_sync';

export function hasActiveReservation(reservation) {
  return Boolean(reservation?.expiresAt && new Date(reservation.expiresAt) > new Date());
}

export function readPersistedReservation() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(RESERVATION_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function clearPersistedReservationSnapshot() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RESERVATION_STORAGE_KEY);
  } catch {}
}

export function persistReservationSnapshot(reservation) {
  if (typeof window === 'undefined' || !reservation?.reservationId) return;
  try {
    window.localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(reservation));
    window.localStorage.setItem(
      RESERVATION_SYNC_EVENT_KEY,
      JSON.stringify({
        reservationId: reservation.reservationId,
        timestamp: Date.now(),
      }),
    );
  } catch {}
}

function isReservationSnapshotCurrent(reservation) {
  if (!hasActiveReservation(reservation)) return false;
  if (!reservation?.savedAt) return true;
  return Date.now() - reservation.savedAt < 30 * 60 * 1000;
}

export function useReservationStorage({
  event,
  selectedTickets,
  setSelectedTickets,
  userId = null,
}) {
  const [cartReservation, setCartReservation] = useState(null);
  const [otherEventReservation, setOtherEventReservation] = useState(null);

  const clearPersistedReservation = useCallback(() => {
    setCartReservation(null);
    setOtherEventReservation(null);
    clearPersistedReservationSnapshot();
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          RESERVATION_SYNC_EVENT_KEY,
          JSON.stringify({
            reservationId: null,
            timestamp: Date.now(),
          }),
        );
      }
    } catch {}
  }, []);

  const persistReservation = useCallback(
    (reservation, itemsOverride = null) => {
      if (!reservation?.reservationId) return;
      const normalizedItems = normalizeReservationItems(itemsOverride ?? reservation.items);
      const nextReservation = {
        reservationId: reservation.reservationId,
        eventId: event?.id,
        eventTitle: event?.title,
        expiresAt: reservation.expiresAt,
        items: normalizedItems,
        orderId: reservation.orderId || null,
        savedAt: Date.now(),
        userId: reservation.userId || reservation.customerId || userId || null,
      };

      setCartReservation((current) => {
        const currentItems = normalizeReservationItems(current?.items || []);
        if (
          current?.reservationId === nextReservation.reservationId &&
          current?.eventId === nextReservation.eventId &&
          current?.expiresAt === nextReservation.expiresAt &&
          JSON.stringify(currentItems) === JSON.stringify(normalizedItems)
        ) {
          return current;
        }
        return nextReservation;
      });

      persistReservationSnapshot(nextReservation);
    },
    [event?.id, event?.title, userId],
  );

  const applyPersistedReservation = useCallback(
    (saved) => {
      if (!saved) {
        setCartReservation(null);
        setOtherEventReservation(null);
        return;
      }

      if (saved.userId && userId && saved.userId !== userId) {
        setCartReservation(null);
        setOtherEventReservation(null);
        clearPersistedReservationSnapshot();
        return;
      }

      const normalizedItems = normalizeReservationItems(saved.items);
      const nextReservation = { ...saved, items: normalizedItems };

      if (saved.eventId === event?.id && isReservationSnapshotCurrent(saved)) {
        setOtherEventReservation(null);
        setCartReservation(nextReservation);
        setSelectedTickets((current) => {
          const currentItems = normalizeReservationItems(current);
          if (JSON.stringify(currentItems) === JSON.stringify(normalizedItems)) {
            return current;
          }
          return hydrateReservationItems(normalizedItems, event?.tickets ?? []);
        });
        return;
      }

      setCartReservation(null);
      if (isReservationSnapshotCurrent(saved)) {
        setOtherEventReservation(nextReservation);
        return;
      }

      setOtherEventReservation(null);
      clearPersistedReservationSnapshot();
    },
    [event?.id, event?.tickets, setSelectedTickets, userId],
  );

  useEffect(() => {
    const saved = readPersistedReservation();
    if (!saved) return;
    applyPersistedReservation(saved);
  }, [applyPersistedReservation]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (eventSnapshot) => {
      if (![RESERVATION_STORAGE_KEY, RESERVATION_SYNC_EVENT_KEY].includes(eventSnapshot.key))
        return;
      applyPersistedReservation(readPersistedReservation());
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyPersistedReservation]);

  return {
    cartReservation,
    otherEventReservation,
    clearPersistedReservation,
    persistReservation,
    setCartReservation,
    setOtherEventReservation,
  };
}
