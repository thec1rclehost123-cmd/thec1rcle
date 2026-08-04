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

export interface HostSettingsTabRenderState<TSettings, TBlock extends string> {
  settingsDraft: TSettings;
  setSettingsDraft: Dispatch<SetStateAction<TSettings>>;
  savingBlockId: TBlock | null;
  handleSaveSettingsBlock: (blockId: TBlock) => Promise<void>;
}

interface HostSettingsTabProps<TSettings, TBlock extends string> {
  sourceSettings: TSettings;
  hydrateSettings: (settings: TSettings) => TSettings;
  externalSavingBlockId?: TBlock | null;
  onSaveSettingsBlock: (blockId: TBlock, settings: TSettings) => Promise<void>;
  children: (state: HostSettingsTabRenderState<TSettings, TBlock>) => ReactNode;
}

function HostSettingsTabComponent<TSettings, TBlock extends string>({
  sourceSettings,
  hydrateSettings,
  externalSavingBlockId = null,
  onSaveSettingsBlock,
  children,
}: HostSettingsTabProps<TSettings, TBlock>) {
  const [settingsDraft, setSettingsDraft] = useState<TSettings>(() =>
    hydrateSettings(sourceSettings),
  );
  const [savingSettingsBlockId, setSavingSettingsBlockId] = useState<TBlock | null>(null);

  useEffect(() => {
    setSettingsDraft(hydrateSettings(sourceSettings));
  }, [hydrateSettings, sourceSettings]);

  const handleSaveSettingsBlock = useCallback(
    async (blockId: TBlock) => {
      setSavingSettingsBlockId(blockId);
      try {
        await onSaveSettingsBlock(blockId, settingsDraft);
      } finally {
        setSavingSettingsBlockId(null);
      }
    },
    [onSaveSettingsBlock, settingsDraft],
  );

  return children({
    settingsDraft,
    setSettingsDraft,
    savingBlockId: savingSettingsBlockId || externalSavingBlockId,
    handleSaveSettingsBlock,
  });
}

export const HostSettingsTab = memo(HostSettingsTabComponent) as typeof HostSettingsTabComponent;
