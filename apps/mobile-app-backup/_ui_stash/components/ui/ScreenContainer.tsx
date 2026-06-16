import { ReactNode } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/design/theme';

interface ScreenContainerProps {
  children: any;
  scrollable?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  padding?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
  refreshing?: boolean;
  dark?: boolean;
}

export function ScreenContainer({
  children,
  scrollable = true,
  edges = ['top', 'bottom', 'left', 'right'],
  padding = true,
  style,
  contentContainerStyle,
  onRefresh,
  refreshing = false,
  dark = true,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingTop = edges.includes('top') ? insets.top : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const paddingLeft = edges.includes('left') ? insets.left : 0;
  const paddingRight = edges.includes('right') ? insets.right : 0;

  const baseStyle = [
    styles.container,
    {
      backgroundColor: dark ? colors.base.DEFAULT : colors.base[50],
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
    },
    style,
  ];

  const innerContentStyle = [padding && styles.padding, contentContainerStyle];

  if (scrollable) {
    return (
      <View style={baseStyle}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={innerContentStyle}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.iris}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={baseStyle}>
      <View style={[styles.flex, innerContentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  padding: {
    paddingHorizontal: 16,
  },
});
