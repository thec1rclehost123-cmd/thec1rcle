import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

/** Safely extract a readable string from an API error body */
function toMsg(err: any, fallback: string): string {
  if (!err) return fallback;
  const raw = err.error ?? err.message ?? err;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (typeof raw === 'object' && raw !== null) {
    return String(raw.message || raw.code || fallback);
  }
  return fallback;
}

export type TicketStatus = 'on_sale' | 'hidden' | 'sold_out' | 'scheduled';

export interface TicketTier {
  id: string;
  name: string;
  status: TicketStatus;
  price: number | null;
  sold: number;
  capacity: number;
  openSale: string | null;
  endSale: string | null;
  description: string;
  entryType: string;
  minPurchaseQuantity: number;
  maxPurchaseQuantity: number;
  promoterEnabled: boolean;
}

export interface TicketFormValues {
  name: string;
  price: string;
  quantity: string;
  openSale: string;
  endSale: string;
  entryType: string;
  minPurchaseQuantity: string;
  maxPurchaseQuantity: string;
  promoterEnabled: boolean;
}

export interface TicketEditFormValues {
  name: string;
  entryType: string;
  price: string;
  quantity: string;
  openSale: string;
  endSale: string;
  minPurchaseQuantity: string;
  maxPurchaseQuantity: string;
  promoterEnabled: boolean;
}

function normalise(raw: any): TicketTier {
  return {
    id: raw.id || raw.name || String(Date.now()),
    name: raw.name || 'Unnamed Tier',
    status: raw.status || 'on_sale',
    price:
      raw.price !== undefined && raw.price !== null && raw.price !== '' ? Number(raw.price) : null,
    sold: Number(raw.sold) || 0,
    capacity: Number(raw.capacity ?? raw.quantity ?? raw.maxQuantity ?? 0),
    openSale: raw.openSale || raw.startSale || raw.openSaleDate || raw.saleStart || null,
    endSale: raw.endSale || raw.endSaleDate || raw.saleEnd || null,
    description: raw.description || '',
    entryType: raw.entryType || 'general',
    minPurchaseQuantity: Number(raw.minPurchaseQuantity ?? 1),
    maxPurchaseQuantity: Number(raw.maxPurchaseQuantity ?? raw.capacity ?? raw.quantity ?? 10),
    promoterEnabled: raw.promoterEnabled !== false,
  };
}

export function tierToEditForm(tier: TicketTier): TicketEditFormValues {
  return {
    name: tier.name,
    entryType: tier.entryType,
    price: tier.price !== null ? String(tier.price) : '',
    quantity: String(tier.capacity),
    openSale: tier.openSale ? tier.openSale.slice(0, 10) : '',
    endSale: tier.endSale ? tier.endSale.slice(0, 10) : '',
    minPurchaseQuantity: String(tier.minPurchaseQuantity),
    maxPurchaseQuantity: String(tier.maxPurchaseQuantity),
    promoterEnabled: tier.promoterEnabled,
  };
}

export interface UseTicketSyncReturn {
  tiers: TicketTier[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  addTier: (form: TicketFormValues) => Promise<unknown>;
  editTier: (tierId: string, form: TicketEditFormValues) => Promise<unknown>;
  deleteTier: (tierId: string) => Promise<unknown>;
  addMutationPending: boolean;
  editMutationPending: boolean;
  deleteMutationPending: boolean;
  editingId: string | null;
  deletingId: string | null;
}

export function useTicketSync(eventId: string, venueId: string): UseTicketSyncReturn {
  const { user } = useDashboardAuth();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await user?.getIdToken();
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });
    },
    [user],
  );

  const baseUrl = `/api/partners/venues/events/${eventId}/tickets?venueId=${venueId}`;

  const query = useQuery<{ tiers: TicketTier[] }>({
    queryKey: ['venue-tickets', eventId, venueId],
    queryFn: async () => {
      if (!eventId) throw new Error('eventId not resolved yet');
      if (!venueId) throw new Error('venueId not resolved yet');

      const res = await authedFetch(baseUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(toMsg(body, `Failed to load ticket tiers (${res.status})`));
      }

      const data = await res.json();
      if (!Array.isArray(data?.tiers)) {
        throw new Error('Ticket tiers response was malformed');
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
      // 1. Load current tiers
      const getRes = await authedFetch(baseUrl);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        throw new Error(toMsg(err, 'Failed to load tiers before adding'));
      }
      const current = await getRes.json();
      const existingTiers: any[] = current.tiers ?? [];

      // 2. Build new tier object
      const newTier = {
        id: `tier_${Date.now()}`,
        name: form.name.trim(),
        price: form.price,
        quantity: form.quantity,
        openSale: form.openSale || null,
        endSale: form.endSale || null,
        entryType: form.entryType,
        minPurchaseQuantity: form.minPurchaseQuantity,
        maxPurchaseQuantity: form.maxPurchaseQuantity,
        promoterEnabled: form.promoterEnabled,
        status: 'on_sale',
        sold: 0,
      };

      // 3. PATCH full array back
      const patchRes = await authedFetch(baseUrl, {
        method: 'PATCH',
        body: JSON.stringify({ tiers: [...existingTiers, newTier] }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(toMsg(err, 'Failed to save ticket'));
      }
      return patchRes.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['venue-tickets', eventId, venueId] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ tierId, form }: { tierId: string; form: TicketEditFormValues }) => {
      // 1. Load current tiers
      const getRes = await authedFetch(baseUrl);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        throw new Error(toMsg(err, 'Failed to load tiers before editing'));
      }
      const current = await getRes.json();
      const existingTiers: any[] = current.tiers ?? [];

      // 2. Merge the edited fields into the matching tier
      const updated = existingTiers.map((t: any) =>
        t.id === tierId
          ? {
              ...t,
              name: form.name.trim(),
              entryType: form.entryType,
              price: form.price,
              quantity: form.quantity,
              startSale: form.openSale || null,
              endSale: form.endSale || null,
              minPurchaseQuantity: form.minPurchaseQuantity,
              maxPurchaseQuantity: form.maxPurchaseQuantity,
              promoterEnabled: form.promoterEnabled,
            }
          : t,
      );

      // 3. PATCH full array back
      const patchRes = await authedFetch(baseUrl, {
        method: 'PATCH',
        body: JSON.stringify({ tiers: updated }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(toMsg(err, 'Failed to update ticket'));
      }
      return patchRes.json();
    },
    onMutate: async ({ tierId }) => {
      setEditingId(tierId);
    },
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['venue-tickets', eventId, venueId] });
    },
    onError: () => {
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tierId: string) => {
      // 1. Load current tiers
      const getRes = await authedFetch(baseUrl);
      if (!getRes.ok) {
        const err = await getRes.json().catch(() => ({}));
        throw new Error(toMsg(err, 'Failed to load tiers before deleting'));
      }
      const current = await getRes.json();
      const remaining: any[] = (current.tiers ?? []).filter((t: any) => t.id !== tierId);

      // 2. PATCH full array back (without the deleted tier)
      const patchRes = await authedFetch(baseUrl, {
        method: 'PATCH',
        body: JSON.stringify({ tiers: remaining }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(toMsg(err, 'Failed to delete ticket'));
      }
      return patchRes.json();
    },
    onMutate: async (tierId) => {
      setDeletingId(tierId);
    },
    onSuccess: async () => {
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ['venue-tickets', eventId, venueId] });
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  return {
    tiers: query.data?.tiers ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    errorMessage:
      query.error instanceof Error ? query.error.message : 'Failed to load ticket tiers',
    addTier: (form) => addMutation.mutateAsync(form),
    editTier: (tierId, form) => editMutation.mutateAsync({ tierId, form }),
    deleteTier: (id) => deleteMutation.mutateAsync(id),
    addMutationPending: addMutation.isPending,
    editMutationPending: editMutation.isPending,
    deleteMutationPending: deleteMutation.isPending,
    editingId,
    deletingId,
  };
}
