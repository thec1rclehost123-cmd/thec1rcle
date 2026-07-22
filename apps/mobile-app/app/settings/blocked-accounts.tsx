import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { apiFetch } from '@/lib/api';
import { unblockUser } from '@/lib/social/moderation';
import {
  DittoSettingsScreen,
  Divider,
  HelperText,
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/DittoSettings';

type BlockedUser = {
  uid: string;
  displayName: string;
  photoURL?: string | null;
};

export default function BlockedAccountsScreen() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ blockedUsers?: BlockedUser[] }>(
        '/api/v1/social/blocks',
        { requireAuth: true },
      );
      setUsers(response.blockedUsers || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to load blocked accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert('Unblock account?', `${user.displayName} will be able to interact with you again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          const result = await unblockUser('', user.uid);
          if (!result.success) {
            Alert.alert('Could not unblock', result.error || 'Please try again.');
            return;
          }
          setUsers((current) => current.filter((item) => item.uid !== user.uid));
        },
      },
    ]);
  };

  return (
    <DittoSettingsScreen title="Blocked Accounts">
      {loading ? (
        <View style={{ paddingVertical: 48 }}>
          <ActivityIndicator color="#F44A22" />
        </View>
      ) : error ? (
        <SettingsGroup>
          <SettingsRow title="Try again" value={error} onPress={() => void load()} />
        </SettingsGroup>
      ) : users.length === 0 ? (
        <View style={{ paddingVertical: 48, paddingHorizontal: 8 }}>
          <Text style={{ color: '#F8F8F8', fontSize: 17, fontWeight: '700' }}>
            No blocked accounts
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 8 }}>
            Accounts you block will appear here.
          </Text>
        </View>
      ) : (
        <SettingsGroup>
          {users.map((user, index) => (
            <View key={user.uid}>
              {index > 0 ? <Divider /> : null}
              <SettingsRow
                title={user.displayName}
                value="Unblock"
                onPress={() => confirmUnblock(user)}
              />
            </View>
          ))}
        </SettingsGroup>
      )}
      <HelperText>
        Blocked accounts cannot message you, invite you, or appear in your social discovery.
      </HelperText>
    </DittoSettingsScreen>
  );
}
