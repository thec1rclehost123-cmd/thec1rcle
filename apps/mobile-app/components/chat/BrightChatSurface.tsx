import { memo, ReactNode, useEffect } from 'react';
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
} from 'react-native-reanimated';
import { ArrowLeft, Send } from 'lucide-react-native';
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
};

type BrightChatSurfaceProps = {
  theme: ChatSurfaceTheme;
  children: ReactNode;
};

export function BrightChatSurface({ theme, children }: BrightChatSurfaceProps) {
  const accent = theme.accentColor || colors.iris;

  return (
    <View style={brightChatStyles.screen}>
      {theme.backgroundImage ? (
        <Image
          source={{ uri: theme.backgroundImage }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={theme.mode === 'dm' ? 6 : 4}
          cachePolicy="memory-disk"
        />
      ) : null}
      <LinearGradient
        colors={
          theme.mode === 'dm'
            ? ['rgba(18, 206, 255, 0.92)', 'rgba(255, 244, 248, 0.84)', 'rgba(255,255,255,0.96)']
            : ['rgba(6, 175, 239, 0.9)', 'rgba(85, 203, 255, 0.78)', 'rgba(255,255,255,0.88)']
        }
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[brightChatStyles.sunWash, { backgroundColor: accent }]} />
      <View style={brightChatStyles.cloudWash} />
      {children}
    </View>
  );
}

type BrightChatHeaderProps = {
  theme: ChatSurfaceTheme;
  onBack: () => void;
  onDetails?: () => void;
  rightAccessory?: ReactNode;
};

export function BrightChatHeader({
  theme,
  onBack,
  onDetails,
  rightAccessory,
}: BrightChatHeaderProps) {
  const content = (
    <>
      <View style={brightChatStyles.heroCluster}>
        <View style={brightChatStyles.heroImageWrap}>
          {theme.heroImage ? (
            <Image
              source={{ uri: theme.heroImage }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Text style={brightChatStyles.heroInitial}>
              {theme.title.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <AvatarStack avatarUrls={theme.avatarUrls || []} />
      </View>
      <View style={brightChatStyles.headerCopy}>
        <Text style={brightChatStyles.headerTitle} numberOfLines={2}>
          {theme.title}
        </Text>
        <Text style={brightChatStyles.headerSubtitle} numberOfLines={1}>
          {theme.subtitle}
        </Text>
      </View>
    </>
  );

  return (
    <View style={brightChatStyles.header}>
      <View style={brightChatStyles.headerTopRow}>
        <Pressable style={brightChatStyles.headerIconButton} onPress={onBack}>
          <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>
        {rightAccessory}
      </View>
      {onDetails ? (
        <Pressable style={brightChatStyles.headerMain} onPress={onDetails}>
          {content}
        </Pressable>
      ) : (
        <View style={brightChatStyles.headerMain}>{content}</View>
      )}
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
          source={{ uri: avatar }}
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
  onLongPress?: () => void;
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
  onLongPress,
}: BrightMessageProps) {
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
        entering={animate ? FadeInDown.delay(Math.min(index * 18, 150)).duration(240) : undefined}
        style={brightChatStyles.announcement}
      >
        <Text style={brightChatStyles.announcementLabel}>{senderName || 'Host update'}</Text>
        <Text style={brightChatStyles.announcementText}>{content}</Text>
        {time ? <Text style={brightChatStyles.announcementTime}>{time}</Text> : null}
      </Animated.View>
    );
  }

  const bubble = (
    <Animated.View
      entering={animate ? FadeInDown.delay(Math.min(index * 18, 150)).duration(240) : undefined}
      style={[
        brightChatStyles.messageWrap,
        isOwnMessage ? brightChatStyles.messageWrapOwn : brightChatStyles.messageWrapOther,
      ]}
    >
      {!isOwnMessage && senderName ? (
        <Text style={brightChatStyles.senderName}>{senderName}</Text>
      ) : null}
      <View
        style={!isOwnMessage ? brightChatStyles.messageRowOther : brightChatStyles.messageRowOwn}
      >
        {!isOwnMessage ? (
          <MessageAvatar senderAvatar={senderAvatar} senderName={senderName} />
        ) : null}
        {type === 'image' ? (
          <Image
            source={{ uri: content }}
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
    </Animated.View>
  );

  if (!onLongPress) return bubble;

  return <Pressable onLongPress={onLongPress}>{bubble}</Pressable>;
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
          source={{ uri: senderAvatar }}
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
};

export function BrightTypingIndicator({ name, avatarUrl }: BrightTypingIndicatorProps) {
  return (
    <Animated.View entering={FadeIn} style={brightChatStyles.typingRow}>
      <MessageAvatar senderAvatar={avatarUrl} senderName={name} />
      <View style={brightChatStyles.typingBubble}>
        <View style={brightChatStyles.typingDots}>
          <TypingDot delay={0} />
          <TypingDot delay={120} />
          <TypingDot delay={240} />
        </View>
        <Text style={brightChatStyles.typingText}>{name} is typing</Text>
      </View>
    </Animated.View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 220 }),
          withTiming(0, { duration: 220 }),
          withTiming(0, { duration: 280 }),
        ),
        -1,
      ),
    );
  }, [delay, lift]);

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
      placeholderTextColor="rgba(30,44,60,0.44)"
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
        <Send size={18} color="#FFFFFF" fill="#FFFFFF" />
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

export const brightChatStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#48C7FF',
  },
  sunWash: {
    position: 'absolute',
    top: 128,
    right: -92,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.18,
  },
  cloudWash: {
    position: 'absolute',
    left: -72,
    bottom: -32,
    width: 280,
    height: 160,
    borderTopRightRadius: 120,
    borderBottomRightRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTopRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  headerMain: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  heroCluster: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageWrap: {
    width: 104,
    height: 104,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroInitial: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 38,
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
    alignItems: 'center',
    marginTop: spacing.md,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 34,
    textAlign: 'center',
    letterSpacing: 0,
    textShadowColor: 'rgba(5,20,38,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
    marginTop: spacing.xs,
    textAlign: 'center',
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
    color: 'rgba(8,28,48,0.72)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    marginLeft: 34,
    marginBottom: spacing.xs,
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
    width: 30,
    height: 30,
    marginRight: -8,
    marginBottom: -4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  messageAvatarInitial: {
    color: colors.iris,
    fontFamily: fonts.display,
    fontSize: typography.fontSize.sm,
  },
  messageBubble: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: 24,
    shadowColor: '#07324A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  otherBubble: {
    borderBottomLeftRadius: radii.sm,
    backgroundColor: '#FFFFFF',
  },
  ownBubble: {
    borderBottomRightRadius: radii.sm,
    backgroundColor: colors.iris,
  },
  messageText: {
    flexShrink: 1,
    color: '#121212',
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.md,
    lineHeight: 21,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    color: 'rgba(18,18,18,0.46)',
    fontFamily: fonts.heading,
    fontSize: 9,
    marginBottom: 1,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.72)',
  },
  messageImage: {
    width: 224,
    height: 168,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  announcement: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    marginHorizontal: spacing.sm,
    padding: spacing.base,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
  },
  announcementLabel: {
    color: colors.iris,
    fontFamily: fonts.display,
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
  },
  announcementText: {
    color: '#141414',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.md,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  announcementTime: {
    color: 'rgba(20,20,20,0.5)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.sm,
  },
  systemWrap: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  systemText: {
    color: 'rgba(8,28,48,0.72)',
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
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 22,
    borderBottomLeftRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
  },
  typingText: {
    color: 'rgba(8,28,48,0.72)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
  },
  composerDock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.74)',
  },
  composerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#07324A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    color: '#121212',
    fontFamily: fonts.body,
    fontSize: typography.fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
  },
  toolButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(244,74,34,0.12)',
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
    textShadowColor: 'rgba(5,20,38,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
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
