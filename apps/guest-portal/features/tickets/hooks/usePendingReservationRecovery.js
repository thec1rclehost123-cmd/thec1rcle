'use client';

import { useEffect, useState } from 'react';
import {
  clearPersistedReservationSnapshot,
  readPersistedReservation,
} from '../../checkout/hooks/useReservationStorage';

export function usePendingReservationRecovery() {
  const [pendingReservation, setPendingReservation] = useState(null);

  useEffect(() => {
    const saved = readPersistedReservation();
    if (!saved) return;
    if (saved.eventId && saved.expiresAt && new Date(saved.expiresAt) > new Date()) {
      setPendingReservation(saved);
      return;
    }
    clearPersistedReservationSnapshot();
  }, []);

  return {
    pendingReservation,
    clearPendingReservation: () => {
      setPendingReservation(null);
      clearPersistedReservationSnapshot();
    },
  };
}
