import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,

  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Send, Heart, Search, Flag, Ban } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/lib/design/theme';

const fonts = typography.fontFamily;

export type ChatSurfaceMode = 'event' | 'dm';

export type ChatSurfaceTheme = {
  mode: ChatSurfaceMode;
  title: string;
  subtitle: string;
  backgroundImage?: string;
  heroImage?: string;
  avatarUrls?: string[];
  accentColor?: string;
  moodColor?: string;
};

type BrightChatSurfaceProps = {
  theme: ChatSurfaceTheme;
  children: ReactNode;
};

export function BrightChatSurface({ theme, children }: BrightChatSurfaceProps) {
  const glowOpacity = useSharedValue(0.12);

  useEffect(() => {
    if (!theme.moodColor) return;
    const interval = setInterval(() => {
      glowOpacity.value = withTiming(glowOpacity.value > 0.08 ? 0.04 : 0.12, {
        duration: 3000,
        easing: Easing.inOut(Easing.sin),
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [theme.moodColor, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={[brightChatStyles.screen, { backgroundColor: '#000000' }]}>
      {children}
    </View>
  );
}

type BrightChatHeaderProps = {
  theme: ChatSurfaceTheme;
  onBack: () => void;
  onDetails?: () => void;
  rightAccessory?: ReactNode;
  compact?: boolean;
};

export function BrightChatHeader({
  theme,
  onBack,
  onDetails,
  rightAccessory,
  compact,
}: BrightChatHeaderProps) {
  const content = (
    <>
      <HeaderAvatarCluster theme={theme} />
      <View style={brightChatStyles.headerCopy}>
        <Text style={brightChatStyles.headerTitle} numberOfLines={1}>
          {theme.title}
        </Text>
        {theme.subtitle ? (
          <Text style={brightChatStyles.headerSubtitle} numberOfLines={1}>
            {theme.subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[brightChatStyles.header, compact && brightChatStyles.headerCompact]}>
      <View style={brightChatStyles.headerTopRow}>
        <Pressable style={brightChatStyles.headerIconButton} onPress={onBack}>
          <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        {onDetails ? (
          <Pressable style={brightChatStyles.headerPill} onPress={onDetails}>
            {content}
          </Pressable>
        ) : (
          <View style={brightChatStyles.headerPill}>{content}</View>
        )}
        {rightAccessory ? (
          <View style={brightChatStyles.headerRightButton}>
            {rightAccessory}
          </View>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>
    </View>
  );
}

function HeaderAvatarCluster({ theme }: { theme: ChatSurfaceTheme }) {
  const avatars = theme.avatarUrls?.length
    ? theme.avatarUrls
    : theme.heroImage
      ? [theme.heroImage]
      : [];

  return (
    <View style={brightChatStyles.headerAvatarCluster}>
      {avatars.slice(0, 3).map((avatar, index) => (
        <Image
          key={`${avatar}-${index}`}
          source={typeof avatar === 'string' ? { uri: avatar } : avatar}
          style={[
            brightChatStyles.headerAvatar,
            { marginLeft: index === 0 ? 0 : -9, zIndex: 3 - index },
          ]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ))}
      {avatars.length === 0 ? (
        <View style={brightChatStyles.headerAvatar}>
          <Text style={brightChatStyles.headerAvatarInitial}>
            {theme.title.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
export function AvatarStack({ avatarUrls }: { avatarUrls: string[] }) {
  if (avatarUrls.length === 0) return null;

  return (
    <View style={brightChatStyles.avatarStack}>
      {avatarUrls.slice(0, 3).map((avatar, index) => (
        <Image
          key={`${avatar}-${index}`}
          source={typeof avatar === 'string' ? { uri: avatar } : avatar}
          style={[brightChatStyles.avatarStackItem, { marginLeft: index === 0 ? 0 : -12 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ))}
    </View>
  );
}

type BrightMessageProps = {
  content: string;
  time?: string;
  senderName?: string;
  senderAvatar?: string;
  isOwnMessage?: boolean;
  type?: 'text' | 'image' | 'announcement' | 'system';
  index?: number;
  animate?: boolean;
  isLiked?: boolean;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  badgeLabel?: string;
  onSwipeReply?: () => void;
  replyContext?: {
    type: 'prompt' | 'photo';
    title: string;
    answer?: string;
    imageUrl?: string;
  };
};

export const BrightMessage = memo(function BrightMessage({
  content,
  time,
  senderName,
  senderAvatar,
  isOwnMessage = false,
  type = 'text',
  index = 0,
  animate = false,
  isLiked = false,
  onLongPress,
  onDoubleTap,
  badgeLabel,
  onSwipeReply,
  replyContext,
}: BrightMessageProps) {
  const lastTapRef = useRef(0);
  const translateX = useSharedValue(0);
  const swipeActivated = useSharedValue(false);

  const handlePress = () => {
    if (!onDoubleTap) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleTap();
      lastTapRef.current = 0; // reset
    } else {
      lastTapRef.current = now;
    }
  };
  if (type === 'system') {
    return (
      <View style={brightChatStyles.systemWrap}>
        <Text style={brightChatStyles.systemText}>{content}</Text>
      </View>
    );
  }

  if (type === 'announcement') {
    return (
      <Animated.View
        entering={animate ? FadeInDown.delay(Math.min(index * 18, 150)).mass(0.6).stiffness(160) : undefined}
        style={brightChatStyles.announcement}
      >
        <Text style={brightChatStyles.announcementLabel}>{senderName || 'Host update'}</Text>
        <Text style={brightChatStyles.announcementText}>{content}</Text>
        {time ? <Text style={brightChatStyles.announcementTime}>{time}</Text> : null}
      </Animated.View>
    );
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([15, 100])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      if (!onSwipeReply) return;
      translateX.value = Math.max(0, Math.min(50, event.translationX));
      if (translateX.value > 40 && !swipeActivated.value) {
        swipeActivated.value = true;
        const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        runOnJS(triggerHaptic)();
      } else if (translateX.value <= 40 && swipeActivated.value) {
        swipeActivated.value = false;
      }
    })
    .onEnd(() => {
      if (!onSwipeReply) return;
      if (swipeActivated.value) {
        runOnJS(onSwipeReply)();
      }
      translateX.value = withTiming(0, { duration: 250 });
      swipeActivated.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bubble = (
    <Animated.View
      entering={animate ? FadeInDown.delay(Math.min(index * 18, 150)).mass(0.6).stiffness(160) : undefined}
      style={[
        brightChatStyles.messageWrap,
        isOwnMessage ? brightChatStyles.messageWrapOwn : brightChatStyles.messageWrapOther,
        animatedStyle,
      ]}
    >
      {!isOwnMessage && senderName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 34, marginBottom: 4 }}>
          <Text style={brightChatStyles.senderName}>{senderName}</Text>
          {badgeLabel ? (
            <View style={brightChatStyles.hostBadge}>
              <Text style={brightChatStyles.hostBadgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View
        style={!isOwnMessage ? brightChatStyles.messageRowOther : brightChatStyles.messageRowOwn}
      >
        {!isOwnMessage ? (
          <MessageAvatar senderAvatar={senderAvatar} senderName={senderName} />
        ) : null}
        {type === 'image' ? (
          <Image
            source={typeof content === 'string' ? { uri: content } : content}
            style={brightChatStyles.messageImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              brightChatStyles.messageBubble,
              isOwnMessage ? brightChatStyles.ownBubble : brightChatStyles.otherBubble,
            ]}
          >
            {replyContext ? (
              <View style={[brightChatStyles.replyContextCard, isOwnMessage && brightChatStyles.replyContextCardOwn]}>
                <Text style={brightChatStyles.replyContextTitle} numberOfLines={1}>{replyContext.title}</Text>
                {replyContext.answer ? (
                  <Text style={brightChatStyles.replyContextAnswer} numberOfLines={2}>{replyContext.answer}</Text>
                ) : null}
              </View>
            ) : null}
            <Text
              style={[
                brightChatStyles.messageText,
                isOwnMessage && brightChatStyles.ownMessageText,
              ]}
            >
              {content}
            </Text>
            {time ? (
              <Text
                style={[
                  brightChatStyles.messageTime,
                  isOwnMessage && brightChatStyles.ownMessageTime,
                ]}
              >
                {time}
              </Text>
            ) : null}
          </View>
        )}
      </View>
      {isLiked && (
        <View style={[brightChatStyles.heartBadge, isOwnMessage ? brightChatStyles.heartBadgeOwn : brightChatStyles.heartBadgeOther]}>
          <Heart size={12} color="#F44A22" fill="#F44A22" />
        </View>
      )}
    </Animated.View>
  );

  if (!onLongPress && !onDoubleTap && !onSwipeReply) return bubble;

  return (
    <GestureDetector gesture={panGesture}>
      <Pressable onPress={handlePress} onLongPress={onLongPress}>
        {bubble}
      </Pressable>
    </GestureDetector>
  );
});

function MessageAvatar({
  senderAvatar,
  senderName,
}: {
  senderAvatar?: string;
  senderName?: string;
}) {
  return (
    <View style={brightChatStyles.messageAvatarPeep}>
      {senderAvatar ? (
        <Image
          source={typeof senderAvatar === 'string' ? { uri: senderAvatar } : senderAvatar}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <Text style={brightChatStyles.messageAvatarInitial}>
          {(senderName || '?').slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

type BrightTypingIndicatorProps = {
  name: string;
  avatarUrl?: string;
  energy?: number; // 0 (gentle) to 1 (intense), default 0.5
};

export function BrightTypingIndicator({ name, avatarUrl, energy = 0.5 }: BrightTypingIndicatorProps) {
  const bounceHeight = 2 + energy * 4;
  const bounceDuration = 280 - energy * 120;
  const restDuration = 320 - energy * 80;

  return (
    <Animated.View entering={FadeIn} style={brightChatStyles.typingRow}>
      <MessageAvatar senderAvatar={avatarUrl} senderName={name} />
      <View style={brightChatStyles.typingBubble}>
        <View style={brightChatStyles.typingDots}>
          <TypingDot delay={0} bounceHeight={bounceHeight} bounceDuration={bounceDuration} restDuration={restDuration} />
          <TypingDot delay={bounceDuration * 0.5} bounceHeight={bounceHeight} bounceDuration={bounceDuration} restDuration={restDuration} />
          <TypingDot delay={bounceDuration} bounceHeight={bounceHeight} bounceDuration={bounceDuration} restDuration={restDuration} />
        </View>
      </View>
    </Animated.View>
  );
}

function TypingDot({ delay, bounceHeight, bounceDuration, restDuration }: {
  delay: number;
  bounceHeight: number;
  bounceDuration: number;
  restDuration: number;
}) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-bounceHeight, { duration: bounceDuration }),
          withTiming(0, { duration: bounceDuration }),
          withTiming(0, { duration: restDuration }),
        ),
        -1,
      ),
    );
  }, [delay, bounceHeight, bounceDuration, restDuration, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
    opacity: lift.value < 0 ? 1 : 0.58,
  }));

  return <Animated.View style={[brightChatStyles.typingDot, animatedStyle]} />;
}

export function BrightComposerDock({
  children,
  error,
}: {
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <View style={brightChatStyles.composerDock}>
      {error ? <Text style={brightChatStyles.errorText}>{error}</Text> : null}
      <View style={brightChatStyles.composerRow}>{children}</View>
    </View>
  );
}

type BrightTextInputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

export function BrightTextInput(props: BrightTextInputProps) {
  return (
    <TextInput
      placeholderTextColor="rgba(255,255,255,0.4)"
      {...props}
      style={[brightChatStyles.input, props.style]}
    />
  );
}

export function BrightSendButton({
  disabled,
  loading,
  cooldownSeconds,
  onPress,
}: {
  disabled?: boolean;
  loading?: boolean;
  cooldownSeconds?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[brightChatStyles.sendButton, disabled && brightChatStyles.sendButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : typeof cooldownSeconds === 'number' && cooldownSeconds > 0 ? (
        <Text style={brightChatStyles.cooldown}>{cooldownSeconds}s</Text>
      ) : (
        <Send size={18} color={colors.iris} fill={colors.iris} />
      )}
    </Pressable>
  );
}

export function BrightToolButton({
  children,
  disabled,
  onPress,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[brightChatStyles.toolButton, disabled && brightChatStyles.sendButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {children}
    </Pressable>
  );
}

export function BrightCenterState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={brightChatStyles.centerState}>
      <Text style={brightChatStyles.centerTitle}>{title}</Text>
      {body ? <Text style={brightChatStyles.centerBody}>{body}</Text> : null}
    </View>
  );
}

export function formatChatTime(value: any, locale: string = 'en-US') {
  if (!value) return '';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

type SwipeAction = {
  label: string;
  icon: ReactNode;
  color: string;
  onPress: () => void;
};

export function SwipeableMessage({
  children,
  actions,
}: {
  children: ReactNode;
  actions: SwipeAction[];
}) {
  const translateX = useSharedValue(0);
  const ACTION_WIDTH = 70;
  const totalActionWidth = actions.length * ACTION_WIDTH;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.max(-totalActionWidth, Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX < -totalActionWidth / 2) {
        translateX.value = withTiming(-totalActionWidth, { duration: 200 });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const tapToClose = Gesture.Tap().onEnd(() => {
    translateX.value = withTiming(0, { duration: 200 });
  });

  const composed = Gesture.Simultaneous(panGesture, tapToClose);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -10 ? 1 : 0,
  }));

  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View
        style={[swipeStyles.actionsContainer, { width: totalActionWidth }, actionsStyle]}
      >
        {actions.map((action, index) => (
          <Pressable
            key={action.label}
            onPress={() => {
              translateX.value = withTiming(0, { duration: 150 });
              action.onPress();
            }}
            style={[swipeStyles.action, { backgroundColor: action.color, width: ACTION_WIDTH }]}
          >
            {action.icon}
            <Text style={swipeStyles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
      <GestureDetector gesture={composed}>
        <Animated.View style={animatedStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});

export const brightChatStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerCompact: {
    paddingBottom: 8,
  },
  headerTopRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerRightButton: {
    minWidth: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
  },
  headerPill: {
    flex: 1,
    maxWidth: 260,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    backgroundColor: '#101012',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerAvatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerAvatar: {
    width: 26,
    height: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#101012',
    backgroundColor: '#1E1E1E',
  },
  headerAvatarInitial: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: 12,
    fontWeight: '700',
  },
  hostBadge: {
    backgroundColor: 'rgba(244,74,34,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  hostBadgeText: {
    color: '#F44A22',
    fontFamily: fonts.heading,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  replyContextCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.iris,
  },
  replyContextCardOwn: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderLeftColor: 'rgba(255,255,255,0.4)',
  },
  replyContextTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  replyContextAnswer: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
  },
  avatarStack: {
    position: 'absolute',
    bottom: -2,
    right: -42,
    flexDirection: 'row',
  },
  avatarStackItem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  headerCopy: {
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.46)',
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  messageWrap: {
    maxWidth: '86%',
    marginBottom: spacing.md,
  },
  messageWrapOwn: {
    alignSelf: 'flex-end',
  },
  messageWrapOther: {
    alignSelf: 'flex-start',
  },
  senderName: {
    color: '#F44A22',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  messageRowOther: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 2,
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageAvatarPeep: {
    width: 26,
    height: 26,
    marginRight: -8,
    marginBottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#1E1E1E',
    zIndex: 2,
  },
  messageAvatarInitial: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
  },
  messageBubble: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
  },
  otherBubble: {
    borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(244,74,34,0.5)',
  },
  ownBubble: {
    borderBottomRightRadius: 6,
    backgroundColor: '#F44A22',
  },
  messageText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.md,
    lineHeight: 21,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fonts.heading,
    fontSize: 9,
    marginBottom: 1,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.3)',
  },
  messageImage: {
    width: 224,
    height: 168,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111111',
  },
  heartBadge: {
    position: 'absolute',
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.18)',
  },
  heartBadgeOwn: {
    left: 12,
  },
  heartBadgeOther: {
    right: 12,
  },
  announcement: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  announcementLabel: {
    color: colors.iris,
    fontFamily: fonts.display,
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
  },
  announcementText: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.md,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  announcementTime: {
    color: 'rgba(255,255,255,0.38)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.sm,
  },
  systemWrap: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.sm,
    borderRadius: radii.pill,
  },
  systemText: {
    color: 'rgba(255,255,255,0.36)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
  },
  typingRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  typingBubble: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 6,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  typingText: {
    color: 'rgba(255,255,255,0.42)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
  },
  composerDock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#000000',
  },
  composerRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 30,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    color: '#FFFFFF',
    fontFamily: fonts.body,
    fontSize: typography.fontSize.md,
    paddingHorizontal: 4,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  toolButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sendButtonDisabled: {
    opacity: 0.48,
  },
  cooldown: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: typography.fontSize.xs,
  },
  centerState: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  centerTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: typography.fontSize['2xl'],
    textAlign: 'center',
  },
  centerBody: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
