import { Alert, View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSettings } from '@/hooks/useSettings';
import {
  DittoSettingsScreen,
  Divider,
  SectionLabel,
  SettingsGroup,
  SettingsRow,
} from '@/components/settings/DittoSettings';
import { typography } from '@/lib/design/theme';

const font = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
};

export default function NotificationSettingsScreen() {
  const { notifications } = useSettings();

  const choose = (title: string) => {
    Alert.alert(title, 'Channel controls will be available soon.', [{ text: 'OK' }]);
  };

  return (
    <DittoSettingsScreen title="Notifications">
      <View style={styles.hero}>
        <Bell size={21} color="#8C8C8E" strokeWidth={2.2} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Don't Miss a Thing</Text>
          <Text style={styles.heroBody}>
            Turn on push notification to keep up with event updates and chats.
          </Text>
          <Text style={styles.heroAction}>Enable Notifications</Text>
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
          value={notifications.events ? 'Email, SMS, Push' : 'Off'}
          onPress={() => choose('Event Invites')}
        />
        <Divider />
        <SettingsRow
          title="Event Reminders"
          value={notifications.events ? 'Email, SMS, Push' : 'Off'}
          onPress={() => choose('Event Reminders')}
        />
        <Divider />
        <SettingsRow
          title="Event Blasts"
          value={notifications.promo ? 'Email, SMS, Push' : 'Off'}
          onPress={() => choose('Event Blasts')}
        />
        <Divider />
        <SettingsRow
          title="Event Updates"
          value={notifications.events ? 'Email, Push' : 'Off'}
          onPress={() => choose('Event Updates')}
        />
        <Divider />
        <SettingsRow
          title="Feedback Requests"
          value="Email"
          onPress={() => choose('Feedback Requests')}
        />
      </SettingsGroup>

      <SectionLabel title="Events You Host" />
      <SettingsGroup>
        <SettingsRow
          title="Guest Registrations"
          value="Email, Push"
          onPress={() => choose('Guest Registrations')}
        />
        <Divider />
        <SettingsRow
          title="Feedback Responses"
          value="Email"
          onPress={() => choose('Feedback Responses')}
        />
      </SettingsGroup>

      <SectionLabel title="Calendars You Manage" />
      <SettingsGroup>
        <SettingsRow
          title="New Members"
          value="Email, Push"
          onPress={() => choose('New Members')}
        />
        <Divider />
        <SettingsRow
          title="Event Submissions"
          value="Email"
          onPress={() => choose('Event Submissions')}
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
  heroAction: {
    color: '#3C91FF',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.medium,
  },
});
