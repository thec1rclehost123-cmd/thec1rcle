import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export type TicketStatus = "on_sale" | "hidden" | "sold_out" | "scheduled";

export interface TicketTier {
    id: string;
    name: string;
    status: TicketStatus;
    price: number | null;
    sold: number;
    capacity: number;
    openSale: string | null;
    endSale: string | null;
}

export interface TicketFormValues {
    name: string;
    price: string;
    quantity: string;
    openSale: string;
    endSale: string;
}

function normalise(raw: any): TicketTier {
    return {
        id: raw.id || raw.name || String(Date.now()),
        name: raw.name || "Unnamed Tier",
        status: raw.status || "on_sale",
        price: raw.price !== undefined && raw.price !== null && raw.price !== ""
            ? Number(raw.price)
            : null,
        sold: Number(raw.sold) || 0,
        capacity: Number(raw.capacity ?? raw.quantity ?? raw.maxQuantity ?? 0),
        openSale: raw.openSale || raw.openSaleDate || raw.saleStart || null,
        endSale: raw.endSale || raw.endSaleDate || raw.saleEnd || null,
    };
}

export interface UseTicketSyncReturn {
    tiers: TicketTier[];
    isLoading: boolean;
    isError: boolean;
    errorMessage: string | null;
    addTier: (form: TicketFormValues) => Promise<unknown>;
    deleteTier: (tierId: string) => Promise<unknown>;
    addMutationPending: boolean;
    deleteMutationPending: boolean;
    deletingId: string | null;
}

export function useTicketSync(eventId: string, venueId: string): UseTicketSyncReturn {
    const { user } = useDashboardAuth();
    const queryClient = useQueryClient();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = await user?.getIdToken();
        return fetch(url, {
            ...options,
            headers: {
                ...(options.headers ?? {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                "Content-Type": "application/json",
            },
        });
    }, [user]);

    const baseUrl = `/api/partners/venues/events/${eventId}/tickets?venueId=${venueId}`;

    const query = useQuery<{ tiers: TicketTier[] }>({
        queryKey: ["venue-tickets", eventId, venueId],
        queryFn: async () => {
            if (!eventId) throw new Error("eventId not resolved yet");
            if (!venueId) throw new Error("venueId not resolved yet");

            const res = await authedFetch(baseUrl);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Failed to load ticket tiers (${res.status})`);
            }

            const data = await res.json();
            if (!Array.isArray(data?.tiers)) {
                throw new Error("Ticket tiers response was malformed");
            }

            return { tiers: data.tiers.map(normalise) };
        },
        enabled: Boolean(eventId && venueId),
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: true,
        retry: false,
    });

    const addMutation = useMutation({
        mutationFn: async (form: TicketFormValues) => {
            const res = await authedFetch(baseUrl, {
                method: "POST",
                body: JSON.stringify({
                    name: form.name.trim(),
                    price: form.price,
                    quantity: form.quantity,
                    openSale: form.openSale || null,
                    endSale: form.endSale || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to save ticket");
            }
            return res.json() as Promise<{ tier: any }>;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["venue-tickets", eventId, venueId] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (tierId: string) => {
            const res = await authedFetch(`${baseUrl}&tierId=${tierId}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete ticket");
            }
            return res.json();
        },
        onMutate: async (tierId) => {
            setDeletingId(tierId);
        },
        onSuccess: async () => {
            setDeletingId(null);
            await queryClient.invalidateQueries({ queryKey: ["venue-tickets", eventId, venueId] });
        },
        onError: () => {
            setDeletingId(null);
        },
    });

    return {
        tiers: query.data?.tiers ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        errorMessage: query.error instanceof Error ? query.error.message : "Failed to load ticket tiers",
        addTier: (form) => addMutation.mutateAsync(form),
        deleteTier: (id) => deleteMutation.mutateAsync(id),
        addMutationPending: addMutation.isPending,
        deleteMutationPending: deleteMutation.isPending,
        deletingId,
    };
}
