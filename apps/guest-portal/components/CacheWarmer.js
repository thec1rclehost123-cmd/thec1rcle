"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./providers/AuthProvider";
import { fetchTicketsWallet, ticketsWalletQueryKey } from "../features/tickets/ticketsQueries";

/**
 * ⚡ CacheWarmer: Authenticated Wallet Warmup
 *
 * Public discovery data is now server-rendered or page-local.
 * This warmer is intentionally limited to authenticated wallet data until
 * tickets move fully to React Query in the next cleanup slice.
 */
export default function CacheWarmer() {
    const { user, bootstrap, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (user && !authLoading && bootstrap?.routeAccess?.isAuthenticated) {
            const ric = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb) => setTimeout(cb, 200);
            const cancel = typeof cancelIdleCallback !== "undefined" ? cancelIdleCallback : clearTimeout;

            const id = ric(
                () => queryClient.prefetchQuery({
                    queryKey: ticketsWalletQueryKey(user.uid),
                    queryFn: fetchTicketsWallet,
                    staleTime: 2 * 60 * 1000,
                }).catch(err => console.error("CacheWarmer: Failed to pre-warm Tickets", err)),
                { timeout: 3000 }
            );

            return () => cancel(id);
        }
    }, [user, bootstrap?.routeAccess?.isAuthenticated, authLoading, queryClient]);

    return null;
}
