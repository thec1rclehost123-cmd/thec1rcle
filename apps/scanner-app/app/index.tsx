import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginStaff, verifyStaffSession } from '@/lib/api/eventCode';

export default function StaffLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoading(true);
        try {
          const idToken = await user.getIdToken(true);
          const result = await verifyStaffSession(idToken);
          if (result.success) {
            router.replace({
              pathname: '/select-event' as any,
              params: {
                userId: result.userId,
                venueId: result.venueId,
                role: result.role,
              },
            });
          }
        } catch (err) {
          // Silent failure on auto-login, let them login manually
          console.error('Auto-login failed', err);
        } finally {
          setIsLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginStaff(email.trim(), password);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({
          pathname: '/select-event' as any,
          params: {
            userId: result.userId,
            venueId: result.venueId,
            role: result.role,
          },
        });
      } else {
        setError(result.error || 'Invalid email or password');
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to log in');
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-primary">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Logo Section */}
          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-2xl bg-accent items-center justify-center mb-4">
              <Ionicons name="scan" size={40} color="#FFFFFF" />
            </View>
            <Text className="text-3xl font-bold text-text-primary">C1RCLE Scanner</Text>
            <Text className="text-base text-text-secondary mt-2">Staff Portal Authentication</Text>
          </View>

          {/* Login Fields */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }} className="mb-6">
            <View className="mb-4">
              <Text className="text-sm text-text-secondary mb-2 font-medium">EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                placeholder="Enter staff email"
                placeholderTextColor="#71717A"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className={`
                  bg-background-secondary border-2 rounded-xl px-4 py-4
                  text-lg text-text-primary font-semibold
                  ${error ? 'border-error' : 'border-border'}
                `}
                editable={!isLoading}
              />
            </View>

            <View>
              <Text className="text-sm text-text-secondary mb-2 font-medium">PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                placeholder="Enter password"
                placeholderTextColor="#71717A"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className={`
                  bg-background-secondary border-2 rounded-xl px-4 py-4
                  text-lg text-text-primary font-semibold
                  ${error ? 'border-error' : 'border-border'}
                `}
                editable={!isLoading}
              />
            </View>

            {error && (
              <View className="flex-row items-center mt-3">
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text className="text-error text-sm ml-2">{error}</Text>
              </View>
            )}
          </Animated.View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading || !email.trim() || !password.trim()}
            className={`
              rounded-xl py-4 flex-row items-center justify-center mt-2
              ${isLoading || !email.trim() || !password.trim() ? 'bg-accent/50' : 'bg-accent'}
            `}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={22} color="#FFFFFF" />
                <Text className="text-white font-bold text-lg ml-2">Log In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Help Text */}
          <View className="mt-8 items-center">
            <Text className="text-text-muted text-sm text-center">
              Authenticate using your venue staff credentials.{'\n'}
              Contact your venue manager if you need an invitation.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View className="px-6 pb-4">
          <Text className="text-text-muted text-xs text-center">THE C1RCLE Scanner v1.0</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
