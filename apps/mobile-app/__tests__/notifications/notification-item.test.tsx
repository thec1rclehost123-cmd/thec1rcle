import React from 'react';
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  Image: 'Image',
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
  },
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const transition = { delay: () => transition };
  return {
    __esModule: true,
    default: {
      View,
      Text: require('react-native').Text,
      createAnimatedComponent: () => Pressable,
    },
    FadeIn: transition,
    FadeInDown: transition,
    SlideOutRight: transition,
    Layout: transition,
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
  };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: { children: React.ReactNode }) => (
    <View testID="reanimated-swipeable">{children}</View>
  );
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: require('react-native').View,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft', Bell: 'Bell' }));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: null }),
}));

jest.mock('@/store/notificationsStore', () => ({
  useNotificationsStore: () => ({}),
  getNotificationIcon: () => '!',
  getNotificationDeepLink: () => null,
}));

jest.mock('@/lib/analytics', () => ({ trackScreen: jest.fn() }));

import { NotificationItem } from '../../app/notifications';

describe('NotificationItem', () => {
  it('renders inside the supported ReanimatedSwipeable component', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <NotificationItem
          notification={{
            id: 'notification_1',
            type: 'event_reminder',
            title: 'Doors open soon',
            body: 'Your event starts in one hour.',
            read: false,
            createdAt: new Date(),
          }}
          index={0}
          onPress={jest.fn()}
          onClear={jest.fn()}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'reanimated-swipeable' })).toBeTruthy();
    expect(
      renderer.root.findAll(
        (node: any) => node.type === 'Text' && node.props.children === 'Doors open soon',
      ),
    ).toHaveLength(1);
  });
});
