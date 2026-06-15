/**
 * Chat Rate Limiter Hook
 *
 * Prevents chat spam with a local throttle:
 * - Max 1 message per second
 * - After 5 rapid messages, enforces a 5-second cooldown
 * - Returns cooldown state for UI feedback
 */

import * as Haptics from "expo-haptics";
import { useState, useRef, useCallback } from "react";

interface RateLimiterOptions {
  /** Min ms between messages (default: 1000) */
  minInterval?: number;
  /** Number of rapid messages before cooldown (default: 5) */
  burstLimit?: number;
  /** Cooldown duration in ms after burst (default: 5000) */
  cooldownDuration?: number;
}

interface RateLimiterResult {
  /** Whether the user can currently send a message */
  canSend: boolean;
  /** Seconds remaining in cooldown (0 if none) */
  cooldownSeconds: number;
  /** Check rate limit before sending — returns true if allowed */
  checkRateLimit: () => boolean;
}

export function useChatRateLimit(options: RateLimiterOptions = {}): RateLimiterResult {
  const { minInterval = 1000, burstLimit = 5, cooldownDuration = 5000 } = options;

  const [canSend, setCanSend] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const lastSentRef = useRef<number>(0);
  const recentCountRef = useRef<number>(0);
  const windowStartRef = useRef<number>(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback((durationMs: number) => {
    setCanSend(false);
    const endTime = Date.now() + durationMs;

    // Update countdown every second
    const updateCountdown = () => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setCanSend(true);
        setCooldownSeconds(0);
        recentCountRef.current = 0;
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
      } else {
        setCooldownSeconds(remaining);
      }
    };

    setCooldownSeconds(Math.ceil(durationMs / 1000));
    cooldownTimerRef.current = setInterval(updateCountdown, 1000);
  }, []);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();

    // Check min interval
    if (now - lastSentRef.current < minInterval) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return false;
    }

    // Track burst window (rolling 10-second window)
    const BURST_WINDOW = 10_000;
    if (now - windowStartRef.current > BURST_WINDOW) {
      // Reset window
      windowStartRef.current = now;
      recentCountRef.current = 0;
    }

    recentCountRef.current++;

    // Check burst limit
    if (recentCountRef.current >= burstLimit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      startCooldown(cooldownDuration);
      return false;
    }

    lastSentRef.current = now;
    return true;
  }, [minInterval, burstLimit, cooldownDuration, startCooldown]);

  return {
    canSend,
    cooldownSeconds,
    checkRateLimit,
  };
}
