import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Bell, Check, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { colors, typography } from '@/lib/design/theme';
import { DittoSettingsScreen, Divider, SettingsGroup } from '@/components/settings/DittoSettings';

const font = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

export default function AlertPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { notifications, setNotificationSetting } = useSettings();

  const displayName =
    user?.displayName || user?.phoneNumber || user?.email?.split('@')[0] || 'Your account';
  const phoneNumber = user?.phoneNumber || 'No phone number';

  const handleToggleCheck = (key: 'smsTransactional' | 'marketingPromotions') => {
    Haptics.selectionAsync();
    setNotificationSetting(key, !notifications[key]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={25} color="#F8F8F8" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Alert Preferences</Text>
        <View style={styles.headerRightButton}>
          <Bell size={22} color="#F8F8F8" strokeWidth={2.2} />
        </View>
      </View>

      <DittoSettingsScreen title="">
        {/* Profile Info Card */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <User size={40} color="rgba(255,255,255,0.4)" strokeWidth={1.8} />
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profilePhone}>{phoneNumber}</Text>
        </View>

        {/* Allow Alerts Group */}
        <SettingsGroup>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Allow Alerts</Text>
            <Switch
              style={styles.switch}
              value={notifications.allowAlerts}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                setNotificationSetting('allowAlerts', val);
              }}
              trackColor={{ false: '#6A6A6F', true: '#5E6B5F' }}
              thumbColor="#fff"
            />
          </View>
        </SettingsGroup>

        {/* Sub-toggles Checkboxes Group */}
        <SettingsGroup>
          <Pressable onPress={() => handleToggleCheck('smsTransactional')} style={styles.checkRow}>
            <Text style={styles.rowTitle}>SMS Transactional Alerts</Text>
            {notifications.smsTransactional ? (
              <Check size={18} color="#fff" strokeWidth={2.5} />
            ) : null}
          </Pressable>
          <Divider />
          <Pressable
            onPress={() => handleToggleCheck('marketingPromotions')}
            style={styles.checkRow}
          >
            <Text style={styles.rowTitle}>Allow Marketing Emails</Text>
            {notifications.marketingPromotions ? (
              <Check size={18} color="#fff" strokeWidth={2.5} />
            ) : null}
          </Pressable>
        </SettingsGroup>
      </DittoSettingsScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerTitle: {
    color: '#F8F8F8',
    fontSize: 19,
    lineHeight: 24,
    fontFamily: font.bold,
  },
  headerRightButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 25,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#222324',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileName: {
    color: '#F5F5F5',
    fontSize: 24,
    fontFamily: font.bold,
    lineHeight: 30,
    marginBottom: 4,
  },
  profilePhone: {
    color: '#8D8D8F',
    fontSize: 14,
    fontFamily: font.regular,
    lineHeight: 18,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  checkRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowTitle: {
    color: '#F5F5F5',
    fontSize: 16,
    fontFamily: font.medium,
    flex: 1,
  },
  switch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
    marginRight: -8,
  },
});
