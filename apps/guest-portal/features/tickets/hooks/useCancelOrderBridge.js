'use client';

import { useEffect, useState } from 'react';

export function useCancelOrderBridge() {
  const [cancellingOrder, setCancellingOrder] = useState(null);

  useEffect(() => {
    const handler = () => {
      const nextOrder = window.__cancelOrderData;
      if (!nextOrder) return;
      setCancellingOrder(nextOrder);
      window.__cancelOrderData = null;
    };

    window.addEventListener('openCancelOrder', handler);
    return () => window.removeEventListener('openCancelOrder', handler);
  }, []);

  return {
    cancellingOrder,
    closeCancellingOrder: () => setCancellingOrder(null),
    setCancellingOrder,
  };
}
