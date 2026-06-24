import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design/theme';

const font = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

export const dittoText = {
  header: 19,
  section: 17,
  row: 16,
  subtitle: 12,
  value: 12,
  helper: 13,
  small: 11,
};

export function DittoSettingsScreen({ title, children }: { title: string; children: any }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

export function SettingsGroup({ children, style }: { children: any; style?: any }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

export function Divider({ inset = true }: { inset?: boolean }) {
  return <View style={[styles.divider, inset && styles.dividerInset]} />;
}

export function SettingsRow({
  icon,
  title,
  value,
  onPress,
  external = false,
  danger = false,
}: {
  icon?: any;
  title: string;
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
      style={styles.row}
    >
      {icon ? <View style={styles.leadingIcon}>{icon}</View> : null}
      <Text style={[styles.rowTitle, danger && styles.dangerText]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {interactive ? (
          external ? (
            <ExternalLink size={14} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
          ) : (
            <ChevronRight size={17} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
          )
        ) : null}
      </View>
    </Pressable>
  );
}

export function SettingsSwitchRow({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      <Switch
        style={styles.switch}
        value={value}
        onValueChange={(next) => {
          Haptics.selectionAsync();
          onValueChange(next);
        }}
        trackColor={{ false: '#6A6A6F', true: '#5E6B5F' }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function HelperText({ children }: { children: any }) {
  return <Text style={styles.helperText}>{children}</Text>;
}

export function TileIcon({ children }: { children: any }) {
  return <View style={styles.tileIcon}>{children}</View>;
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
    fontSize: dittoText.header,
    lineHeight: 24,
    fontFamily: font.bold,
  },
  headerSpacer: {
    width: 48,
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
    fontSize: dittoText.section,
    lineHeight: 22,
    fontFamily: font.black,
    marginTop: 10,
    marginBottom: 7,
    paddingHorizontal: 14,
  },
  group: {
    backgroundColor: '#222324',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 10,
  },
  row: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leadingIcon: {
    width: 27,
    marginRight: 10,
    alignItems: 'center',
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    color: '#F5F5F5',
    fontSize: dittoText.row,
    lineHeight: 20,
    fontFamily: font.medium,
  },
  rowRight: {
    maxWidth: '58%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rowValue: {
    color: '#9D9D9F',
    fontSize: dittoText.value,
    lineHeight: 16,
    fontFamily: font.medium,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerInset: {
    marginLeft: 14,
  },
  helperText: {
    color: '#9B9B9D',
    fontSize: dittoText.helper,
    lineHeight: 18,
    fontFamily: font.regular,
    marginTop: -10,
    marginBottom: 18,
    paddingHorizontal: 14,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
    marginRight: -8,
  },
  dangerText: {
    color: '#FF8B82',
  },
});
