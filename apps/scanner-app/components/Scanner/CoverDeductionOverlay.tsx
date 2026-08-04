import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CoverPresetItem, CoverWalletContext, debitCoverWallet } from '@/lib/api/coverCharge';

function formatPaise(value: number) {
  return `₹${(value / 100).toFixed(2)}`;
}

export default function CoverDeductionOverlay({
  wallet,
  onDismiss,
  onBalanceChanged,
}: {
  wallet: CoverWalletContext;
  onDismiss: () => void;
  onBalanceChanged: (balancePaise: number) => void;
}) {
  const [selected, setSelected] = useState<CoverPresetItem | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ chargedPaise: number; balancePaise: number } | null>(
    null,
  );
  const idempotencyKey = useRef<string | null>(null);
  const insufficient = Boolean(selected && selected.amountPaise > wallet.currentBalancePaise);

  const selectItem = (item: CoverPresetItem) => {
    // Preserve the operation identity when the operator re-selects the same
    // item after an uncertain response. A different preset is a new charge.
    if (selected?.id !== item.id || !idempotencyKey.current) {
      idempotencyKey.current = randomUUID();
    }
    setSelected(item);
    setError(null);
    setSuccess(null);
  };

  const processDebit = async () => {
    if (!selected || insufficient || processing) return;
    setProcessing(true);
    setError(null);
    const stableKey = idempotencyKey.current || randomUUID();
    idempotencyKey.current = stableKey;
    try {
      const result = await debitCoverWallet({
        walletId: wallet.id,
        presetItemId: selected.id,
        quantity: 1,
        idempotencyKey: stableKey,
      });
      if (!result?.success || !Number.isSafeInteger(result.balanceAfterPaise)) {
        throw new Error(result?.message || 'Cover debit failed');
      }
      setSuccess({
        chargedPaise: selected.amountPaise,
        balancePaise: result.balanceAfterPaise,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught: any) {
      setError(caught?.message || 'Cover debit failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/80">
        <View className="max-h-[88%] rounded-t-3xl bg-background-secondary px-5 pb-8 pt-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-black uppercase tracking-widest text-accent">
                Cover Wallet
              </Text>
              <Text className="mt-1 text-2xl font-black text-text-primary">
                {wallet.guestFirstName || 'Guest'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Close Cover Wallet"
              onPress={onDismiss}
              className="h-11 w-11 items-center justify-center rounded-xl bg-background-primary"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View className="my-5 rounded-2xl border border-border bg-background-primary p-4">
            <Text className="text-xs font-bold uppercase text-text-muted">Live balance</Text>
            <Text className="mt-1 text-3xl font-black text-text-primary">
              {formatPaise(success?.balancePaise ?? wallet.currentBalancePaise)}
            </Text>
          </View>

          {success ? (
            <View className="items-center py-8">
              <Ionicons name="checkmark-circle" size={72} color="#22C55E" />
              <Text className="mt-4 text-xl font-black text-text-primary">
                Charged {formatPaise(success.chargedPaise)}
              </Text>
              <TouchableOpacity
                className="mt-6 rounded-xl bg-accent px-8 py-4"
                onPress={() => onBalanceChanged(success.balancePaise)}
              >
                <Text className="font-black text-white">Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text className="mb-3 text-xs font-black uppercase tracking-wider text-text-muted">
                Select a preset item
              </Text>
              <ScrollView className="max-h-72" contentContainerStyle={{ gap: 10 }}>
                {(wallet.rules.allowedPresetItems || [])
                  .filter((item) => item.isAvailable !== false)
                  .map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => selectItem(item)}
                      className={`flex-row items-center justify-between rounded-xl border p-4 ${
                        selected?.id === item.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-background-primary'
                      }`}
                    >
                      <Text className="font-bold text-text-primary">{item.name}</Text>
                      <Text className="font-black text-text-primary">
                        {formatPaise(item.amountPaise)}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              {insufficient && (
                <Text className="mt-4 font-bold text-error">
                  Insufficient wallet balance. No debit will be attempted.
                </Text>
              )}
              {error && <Text className="mt-4 font-bold text-error">{error}</Text>}

              <TouchableOpacity
                testID="cover-charge-process"
                disabled={!selected || insufficient || processing}
                onPress={processDebit}
                className={`mt-5 flex-row items-center justify-center rounded-xl py-4 ${
                  !selected || insufficient || processing ? 'bg-accent/40' : 'bg-accent'
                }`}
              >
                {processing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-black text-white">
                    {selected ? `Charge ${formatPaise(selected.amountPaise)}` : 'Select an item'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
