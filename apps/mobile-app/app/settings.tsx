/**
 * Settings Screen
 * Ditto-style settings hub. Detail rows open dedicated settings pages.
 */

import { useEffect } from 'react';
import { Alert, View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleUser,
  ExternalLink,
  Eye,
  Mail,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { colors, typography } from '@/lib/design/theme';
import { trackScreen } from '@/lib/analytics';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { getFirebaseAuth } from '@/lib/firebase';

type IconTone =
  | 'account'
  | 'payment'
  | 'notifications'
  | 'permissions'
  | 'appearance'
  | 'support'
  | 'store'
  | 'instagram'
  | 'x'
  | 'danger';

const font = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

const textSize = {
  header: 19,
  section: 17,
  row: 16,
  subtitle: 12,
  caption: 10,
  version: 11,
};

const layoutSize = {
  backButton: 48,
  iconTile: 28,
  avatar: 41,
  rowMin: 45,
  rowNoIconMin: 42,
  groupRadius: 20,
  groupGap: 10,
};

function SettingIcon({ tone, children }: { tone: IconTone; children: any }) {
  return <View style={[styles.iconTile, iconToneStyles[tone]]}>{children}</View>;
}

function Group({ children, delay = 0 }: { children: any; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.group}>
      {children}
    </Animated.View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SectionLabel({ title, delay = 0 }: { title: string; delay?: number }) {
  return (
    <Animated.Text entering={FadeIn.delay(delay)} style={styles.sectionLabel}>
      {title}
    </Animated.Text>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  external = false,
  danger = false,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
}) {
  const interactive = Boolean(onPress);
  return (
    <Pressable
      disabled={!interactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[styles.row, !icon && styles.rowNoIcon]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && styles.dangerText]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {value ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {interactive ? (
          external ? (
            <ExternalLink size={15} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
          ) : (
            <ChevronRight size={17} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
          )
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const displayName =
    user?.displayName || user?.phoneNumber || user?.email?.split('@')[0] || 'Your account';
  const isPrioritySupport = profile?.supportQueue === 'priority' || profile?.isPremium === true;
  const supportMailto = isPrioritySupport
    ? 'mailto:support@thec1rcle.com?subject=C1RCLE%20Premium%20Priority%20Support'
    : 'mailto:support@thec1rcle.com?subject=C1RCLE%20Support';

  useEffect(() => {
    trackScreen('Settings');
  }, []);

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete My Account',
      'This permanently deletes your profile, photos, likes, passes, and account access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch('/api/v1/users/me', { method: 'DELETE' });
              // Also delete the Firebase Auth account so it is fully removed
              const auth = getFirebaseAuth();
              if (auth.currentUser) {
                await auth.currentUser.delete().catch(() => undefined);
              }
              await AsyncStorage.clear();
              useProfileStore.getState().clearProfile();
              useAuthStore.getState().setUser(null);
              await signOut().catch(() => undefined);
              router.replace('/(auth)/login');
            } catch (error: any) {
              Alert.alert('Could not delete account', error?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={25} color="#F8F8F8" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Group delay={80}>
          <SettingsRow
            icon={
              <LinearGradient
                colors={['#E8E0FF', '#C7FFE1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarFace}>••{'\n'}⌣</Text>
              </LinearGradient>
            }
            title={displayName}
            subtitle="View Profile"
            onPress={() => router.push('/(tabs)/profile')}
          />
          <Divider />
          <SettingsRow title="Edit Profile" onPress={() => router.push('/profile/edit')} />
        </Group>

        <Group delay={140}>
          <SettingsRow
            icon={
              <SettingIcon tone="account">
                <CircleUser
                  size={17}
                  color="#fff"
                  fill="rgba(255,255,255,0.45)"
                  strokeWidth={2.2}
                />
              </SettingIcon>
            }
            title="Account Settings"
            onPress={() => router.push('/settings/account' as any)}
          />
          <Divider />
          <SettingsRow
            icon={
              <SettingIcon tone="payment">
                <Wallet size={17} color="#fff" fill="rgba(255,255,255,0.25)" strokeWidth={2.2} />
              </SettingIcon>
            }
            title="Payment"
            onPress={() => router.push('/settings/payment' as any)}
          />
        </Group>

        <SectionLabel title="Preferences" delay={200} />
        <Group delay={240}>
          <SettingsRow
            icon={
              <SettingIcon tone="notifications">
                <Bell size={17} color="#fff" fill="#fff" strokeWidth={2.2} />
              </SettingIcon>
            }
            title="Notifications"
            onPress={() => router.push('/settings/notifications' as any)}
          />
          <Divider />
          <SettingsRow
            icon={
              <SettingIcon tone="permissions">
                <ShieldCheck
                  size={17}
                  color="#fff"
                  fill="rgba(255,255,255,0.35)"
                  strokeWidth={2.2}
                />
              </SettingIcon>
            }
            title="Permissions"
            onPress={() => router.push('/settings/permissions' as any)}
          />
          <Divider />
          <SettingsRow
            icon={
              <SettingIcon tone="appearance">
                <Eye size={17} color="#fff" strokeWidth={2.2} />
              </SettingIcon>
            }
            title="Appearance"
            onPress={() => router.push('/settings/appearance' as any)}
          />
        </Group>

        <SectionLabel title="Resources" delay={300} />
        <Group delay={340}>
          <SettingsRow
            icon={
              <SettingIcon tone="support">
                <Mail size={17} color="#fff" fill="rgba(255,255,255,0.25)" strokeWidth={2.2} />
              </SettingIcon>
            }
            title="Contact Support"
            onPress={() => openLink(supportMailto)}
          />
          <Divider />
          <SettingsRow
            icon={
              <SettingIcon tone="store">
                <Text style={styles.starIcon}>★</Text>
              </SettingIcon>
            }
            title="Rate in App Store"
            onPress={() => openLink('https://thec1rcle.com')}
            external
          />
          <Divider />
          <SettingsRow
            icon={
              <SettingIcon tone="instagram">
                <Text style={styles.brandIcon}>◎</Text>
              </SettingIcon>
            }
            title="THEC1RCLE on Instagram"
            onPress={() => openLink('https://instagram.com/thec1rcle')}
            external
          />
          <Divider />
          <SettingsRow
            icon={
              <SettingIcon tone="x">
                <X size={15} color="#fff" strokeWidth={2.4} />
              </SettingIcon>
            }
            title="THEC1RCLE on X (Twitter)"
            onPress={() => openLink('https://x.com/thec1rcle')}
            external
          />
        </Group>

        <SectionLabel title="Build Info" delay={360} />
        <Group delay={380}>
          <SettingsRow title="App Version" value="1.0.0" />
          <Divider />
          <SettingsRow title="Build Version" value="2117" />
          <Divider />
          <SettingsRow
            title="Legal"
            value="Privacy & Terms"
            onPress={() => router.push('/legal/privacy' as any)}
          />
        </Group>

        <SectionLabel title="Danger Zone" delay={400} />
        <Group delay={420}>
          <SettingsRow
            icon={
              <SettingIcon tone="danger">
                <Trash2 size={16} color="#F44A22" strokeWidth={2.3} />
              </SettingIcon>
            }
            title="Delete My Account"
            onPress={handleDeleteAccount}
            danger
          />
          <Divider />
          <SettingsRow title="Logout" onPress={handleLogout} danger />
        </Group>
      </ScrollView>
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
    width: layoutSize.backButton,
    height: layoutSize.backButton,
    borderRadius: layoutSize.backButton / 2,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerTitle: {
    color: '#F8F8F8',
    fontSize: textSize.header,
    lineHeight: 24,
    fontFamily: font.bold,
  },
  headerSpacer: {
    width: layoutSize.backButton,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 150,
  },
  sectionLabel: {
    color: '#8D8D8F',
    fontSize: textSize.section,
    lineHeight: 22,
    fontFamily: font.black,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 13,
  },
  group: {
    backgroundColor: '#222324',
    borderRadius: layoutSize.groupRadius,
    overflow: 'hidden',
    marginBottom: layoutSize.groupGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layoutSize.rowMin,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  rowNoIcon: {
    minHeight: layoutSize.rowNoIconMin,
  },
  avatar: {
    width: layoutSize.avatar,
    height: layoutSize.avatar,
    borderRadius: layoutSize.avatar / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarFace: {
    color: '#0B0B0D',
    fontSize: 13,
    lineHeight: 13,
    fontFamily: font.black,
    textAlign: 'center',
  },
  iconTile: {
    width: layoutSize.iconTile,
    height: layoutSize.iconTile,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  accountIcon: {
    backgroundColor: '#A7A7A7',
  },
  paymentIcon: {
    backgroundColor: '#7044FF',
  },
  notificationsIcon: {
    backgroundColor: '#F35A4C',
  },
  permissionsIcon: {
    backgroundColor: '#62C96C',
  },
  appearanceIcon: {
    backgroundColor: '#E94294',
  },
  supportIcon: {
    backgroundColor: '#4B91FF',
  },
  storeIcon: {
    backgroundColor: '#F5CF39',
  },
  instagramIcon: {
    backgroundColor: '#E94878',
  },
  xIcon: {
    backgroundColor: '#141414',
  },
  dangerIcon: {
    backgroundColor: 'rgba(244,74,34,0.15)',
  },
  brandIcon: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 20,
    fontFamily: font.black,
  },
  starIcon: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 19,
    fontFamily: font.black,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: '#F5F5F5',
    fontSize: textSize.row,
    lineHeight: 20,
    fontFamily: font.medium,
  },
  rowSubtitle: {
    color: '#A6A6A8',
    fontSize: textSize.subtitle,
    lineHeight: 16,
    fontFamily: font.regular,
    marginTop: 1,
  },
  dangerText: {
    color: '#F44A22',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: 52,
  },
  versionInfo: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  versionText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: textSize.version,
    fontFamily: font.bold,
  },
  versionNumber: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: textSize.caption,
    fontFamily: font.medium,
    marginTop: 4,
  },
});

const iconToneStyles = {
  account: styles.accountIcon,
  payment: styles.paymentIcon,
  notifications: styles.notificationsIcon,
  permissions: styles.permissionsIcon,
  appearance: styles.appearanceIcon,
  support: styles.supportIcon,
  store: styles.storeIcon,
  instagram: styles.instagramIcon,
  x: styles.xIcon,
  danger: styles.dangerIcon,
};
