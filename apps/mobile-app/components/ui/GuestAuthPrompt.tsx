import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';

interface GuestAuthPromptProps {
  onDismiss: () => void;
}

export function GuestAuthPrompt({ onDismiss }: GuestAuthPromptProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={guestStyles.root}>
        <LinearGradient colors={['#F44A22', '#FF805E']} style={guestStyles.iconWrap}>
          <Sparkles size={30} color="#fff" />
        </LinearGradient>
        <Text style={guestStyles.eyebrow}>UNLOCK THE FULL NIGHT</Text>
        <Text style={guestStyles.title}>Make this night yours</Text>
        <Text style={guestStyles.subtitle}>
          Join THE C1RCLE for tickets, guest lists, event chats and the people going with you.
        </Text>
        <Pressable
          style={guestStyles.primaryBtn}
          onPress={() => {
            useAuthStore.getState().setGuestMode(false);
            router.push('/(auth)/login');
          }}
        >
          <Text style={guestStyles.primaryBtnText}>Join THE C1RCLE</Text>
        </Pressable>
        <Pressable style={guestStyles.dismissBtn} onPress={onDismiss}>
          <Text style={guestStyles.dismissText}>Keep exploring</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },
});

const guestStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  eyebrow: { color: '#F44A22', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 8 },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  primaryBtn: {
    backgroundColor: '#F44A22',
    width: '100%',
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  dismissBtn: {
    paddingVertical: 10,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
});
