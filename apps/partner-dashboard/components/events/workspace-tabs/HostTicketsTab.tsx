'use client';

import {
  memo,
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

interface TierIdentity {
  id: string;
}

export interface HostTicketsTabRenderState<TDraft> {
  ticketDrafts: Record<string, TDraft>;
  setTicketDrafts: Dispatch<SetStateAction<Record<string, TDraft>>>;
  savingTierId: string | null;
  expandedTierId: string | null;
  setExpandedTierId: Dispatch<SetStateAction<string | null>>;
  handleSaveTier: (tierId: string) => Promise<void>;
}

interface HostTicketsTabProps<TTier extends TierIdentity, TDraft> {
  tiers?: readonly TTier[];
  buildDraft: (tier: TTier) => TDraft;
  onSaveTier: (tierId: string, draft: TDraft) => Promise<void>;
  children: (state: HostTicketsTabRenderState<TDraft>) => ReactNode;
}

function HostTicketsTabComponent<TTier extends TierIdentity, TDraft>({
  tiers,
  buildDraft,
  onSaveTier,
  children,
}: HostTicketsTabProps<TTier, TDraft>) {
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, TDraft>>({});
  const [savingTierId, setSavingTierId] = useState<string | null>(null);
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);

  useEffect(() => {
    if (!tiers?.length) {
      setTicketDrafts({});
      return;
    }

    setTicketDrafts(
      tiers.reduce<Record<string, TDraft>>((drafts, tier) => {
        drafts[tier.id] = buildDraft(tier);
        return drafts;
      }, {}),
    );
  }, [buildDraft, tiers]);

  const handleSaveTier = useCallback(
    async (tierId: string) => {
      const draft = ticketDrafts[tierId];
      if (!draft) return;

      setSavingTierId(tierId);
      try {
        await onSaveTier(tierId, draft);
      } finally {
        setSavingTierId(null);
      }
    },
    [onSaveTier, ticketDrafts],
  );

  return children({
    ticketDrafts,
    setTicketDrafts,
    savingTierId,
    expandedTierId,
    setExpandedTierId,
    handleSaveTier,
  });
}

export const HostTicketsTab = memo(HostTicketsTabComponent) as typeof HostTicketsTabComponent;
