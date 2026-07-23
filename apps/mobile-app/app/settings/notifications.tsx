import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Bell } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/hooks/useSettings';
import {
  DittoSettingsScreen,
  Divider,
  SectionLabel,
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/DittoSettings';
import { typography } from '@/lib/design/theme';
import {
  checkNotificationSystemPermission,
  showSettingsAlert,
} from '@/lib/permissions';
import { registerPushToken } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';

const font = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
};

export default function NotificationSettingsScreen() {
  const { notifications, setNotificationSetting } = useSettings();
  const userId = useAuthStore((state) => state.user?.uid);
  const [systemGranted, setSystemGranted] = useState(true);

  useEffect(() => {
    checkNotificationSystemPermission().then((granted) => {
      setSystemGranted(granted);
      if (granted && !notifications.allowAlerts) {
        setNotificationSetting('allowAlerts', true);
      }
    });
  }, []);

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotificationSetting(key, !notifications[key]);
  };

  const enablePushNotifications = async () => {
    Haptics.selectionAsync();
    if (!userId) return;

    const registered = await registerPushToken(userId, { requestPermission: true });
    const granted = await checkNotificationSystemPermission();
    setSystemGranted(granted);

    if (granted) {
      if (!notifications.allowAlerts) setNotificationSetting('allowAlerts', true);
      return;
    }

    if (!registered) {
      showSettingsAlert(
        'Push Notifications',
        'Push notification permission is disabled. Open system settings to enable it.',
      );
    }
  };

  const channelValue = (enabled: boolean, channels = 'Email, SMS, Push') =>
    enabled ? channels : 'Off';

  return (
    <DittoSettingsScreen title="Notifications">
      <View style={styles.hero}>
        <Bell size={21} color="#8C8C8E" strokeWidth={2.2} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Don't Miss a Thing</Text>
          <Text style={styles.heroBody}>
            Turn on push notification to keep up with event updates and chats.
          </Text>
          {systemGranted ? (
            <Text style={styles.heroActionEnabled}>Notifications Enabled</Text>
          ) : (
            <Pressable
              onPress={enablePushNotifications}
            >
              <Text style={styles.heroActionDisabled}>Enable in Settings →</Text>
            </Pressable>
          )}
        </View>
      </View>

      <SettingsGroup>
        <SettingsRow
          title="Alert Preferences"
          onPress={() => router.push('/settings/alert-preferences')}
        />
      </SettingsGroup>

      <SectionLabel title="Events You Attend" />
      <SettingsGroup>
        <SettingsRow
          title="Event Invites"
          value={channelValue(notifications.eventInvites)}
          onPress={() => toggleNotification('eventInvites')}
        />
        <Divider />
        <SettingsRow
          title="Event Reminders"
          value={channelValue(notifications.eventReminders)}
          onPress={() => toggleNotification('eventReminders')}
        />
        <Divider />
        <SettingsRow
          title="Event Blasts"
          value={channelValue(notifications.eventBlasts)}
          onPress={() => toggleNotification('eventBlasts')}
        />
        <Divider />
        <SettingsRow
          title="Event Updates"
          value={channelValue(notifications.eventUpdates, 'Email, Push')}
          onPress={() => toggleNotification('eventUpdates')}
        />
        <Divider />
        <SettingsRow
          title="Feedback Requests"
          value={channelValue(notifications.feedbackRequests, 'Email')}
          onPress={() => toggleNotification('feedbackRequests')}
        />
      </SettingsGroup>

      <SectionLabel title="Events You Host" />
      <SettingsGroup>
        <SettingsRow
          title="Guest Registrations"
          value={channelValue(notifications.guestRegistrations, 'Email, Push')}
          onPress={() => toggleNotification('guestRegistrations')}
        />
        <Divider />
        <SettingsRow
          title="Feedback Responses"
          value={channelValue(notifications.feedbackResponses, 'Email')}
          onPress={() => toggleNotification('feedbackResponses')}
        />
      </SettingsGroup>

      <SectionLabel title="Calendars You Manage" />
      <SettingsGroup>
        <SettingsRow
          title="New Members"
          value={channelValue(notifications.newMembers, 'Email, Push')}
          onPress={() => toggleNotification('newMembers')}
        />
        <Divider />
        <SettingsRow
          title="Event Submissions"
          value={channelValue(notifications.eventSubmissions, 'Email')}
          onPress={() => toggleNotification('eventSubmissions')}
        />
      </SettingsGroup>
    </DittoSettingsScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#222324',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 15,
    marginBottom: 10,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: '#F5F5F5',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: font.bold,
    marginBottom: 5,
  },
  heroBody: {
    color: '#A6A6A8',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.regular,
    marginBottom: 10,
  },
  heroActionEnabled: {
    color: '#34C759',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.medium,
  },
  heroActionDisabled: {
    color: '#3C91FF',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.medium,
  },
});
