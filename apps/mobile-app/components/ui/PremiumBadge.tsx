import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';

type PremiumBadgeProps = {
  visible?: boolean;
  compact?: boolean;
  style?: StyleProp<Omit<ViewStyle, 'display'>>;
};

export function PremiumBadge({ visible = true, compact = false, style }: PremiumBadgeProps) {
  if (!visible) return null;

  return (
    <LinearGradient
      colors={['#FFE8A3', '#D99A28']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, compact && styles.badgeCompact, style]}
    >
      <Crown size={compact ? 12 : 14} color="#2B1600" strokeWidth={2.6} />
      {!compact ? <Text style={styles.label}>Premium</Text> : null}
    </LinearGradient>
  );
}

export function PremiumBadgeDot({ visible = true, style }: PremiumBadgeProps) {
  if (!visible) return null;
  return (
    <View style={[styles.dot, style]}>
      <Crown size={10} color="#2B1600" strokeWidth={2.7} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 25,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  badgeCompact: {
    width: 24,
    height: 24,
    minHeight: 24,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  label: {
    color: '#2B1600',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  dot: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6C55B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
  },
});

export default PremiumBadge;
