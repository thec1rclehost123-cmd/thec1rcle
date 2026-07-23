import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';

interface GuestAuthPromptProps {
  onDismiss: () => void;
}

export function GuestAuthPrompt({ onDismiss }: GuestAuthPromptProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={guestStyles.root}>
        <View style={guestStyles.iconWrap}>
          <Sparkles size={36} color="#fff" />
        </View>
        <Text style={guestStyles.title}>Join THE C1RCLE</Text>
        <Text style={guestStyles.subtitle}>
          Create an account to buy tickets, chat with attendees, and RSVP.
        </Text>
        <Pressable
          style={guestStyles.primaryBtn}
          onPress={() => {
            useAuthStore.getState().setGuestMode(false);
            router.push('/(auth)/login');
          }}
        >
          <Text style={guestStyles.primaryBtnText}>Log In</Text>
        </Pressable>
        <Pressable
          style={guestStyles.secondaryBtn}
          onPress={() => {
            useAuthStore.getState().setGuestMode(false);
            router.push('/(auth)/login');
          }}
        >
          <Text style={guestStyles.secondaryBtnText}>Sign Up</Text>
        </Pressable>
        <Pressable style={guestStyles.dismissBtn} onPress={onDismiss}>
          <Text style={guestStyles.dismissText}>Continue Browsing</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111113',
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
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
    backgroundColor: '#fff',
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
