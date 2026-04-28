"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/providers/AuthProvider";
import { useToast } from "../../../components/providers/ToastProvider";
import { fetchQueueEventPreview, fetchQueueStatus, joinEventQueue } from "../api/queueApi";

function persistAdmissionToken(eventId, token) {
  if (typeof window === "undefined" || !token) return;
  window.sessionStorage.setItem(`admission_token_${eventId}`, token);
}

function getStartingPrice(eventData) {
  return Number(
    eventData?.priceRange?.min ??
      eventData?.priceMin ??
      eventData?.startingPrice ??
      eventData?.price ??
      0
  );
}

export function useWaitingRoom(eventId) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState("initializing");
  const [queueData, setQueueData] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [waitTime, setWaitTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef(null);

  const returnTo = searchParams.get("returnTo") || `/event/${eventId}`;

  const clearHeartbeat = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(
    async (queueId) => {
      try {
        const data = await fetchQueueStatus(eventId, queueId);
        setErrorMessage("");

        if (data.status === "admitted" || data.status === "payment_failed") {
          persistAdmissionToken(eventId, data.token);
          setQueueData(data);
          setStatus("admitted");

          if (data.status === "payment_failed") {
            toast("Payment Retry Window Active!", "success");
          }

          clearHeartbeat();
          timerRef.current = setInterval(() => {
            void refreshStatus(queueId);
          }, 10000);

          setTimeout(() => {
            router.push(returnTo);
          }, 1500);
          return;
        }

        if (data.status === "waiting") {
          setQueueData(data);
          setStatus("waiting");
          setWaitTime(Math.ceil(Number(data.lanePosition || data.position || 0) * 0.3));
          return;
        }

        if (data.status === "expired" || data.status === "abandoned") {
          setQueueData(data);
          setStatus("expired");
          clearHeartbeat();
        }
      } catch (error) {
        setErrorMessage(error?.message || "We lost connection to the queue. Retrying automatically.");
        setStatus((current) => (current === "waiting" || current === "admitted" ? current : "error"));
      }
    },
    [clearHeartbeat, eventId, returnTo, router, toast]
  );

  useEffect(() => {
    if (!eventId) return undefined;

    document.title = "Virtual Waiting Room | THE C1RCLE";

    let cancelled = false;

    async function loadPreview() {
      try {
        const preview = await fetchQueueEventPreview(eventId);
        if (!cancelled) {
          setEventData(preview);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error?.message || "We could not load the event preview.");
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const join = useCallback(async () => {
    if (!user) {
      const next = `/event/${eventId}/queue${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      const result = await joinEventQueue(eventId);
      setErrorMessage("");

      if (result.statusCode === 429) {
        toast("Too many attempts. Please slow down.", "error");
        setErrorMessage("Too many attempts. Please wait a moment and try again.");
        setStatus("error");
        return;
      }

      if (result.statusCode === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/event/${eventId}/queue`)}`);
        return;
      }

      if (!result.data?.id) {
        setErrorMessage("The waiting room did not return a valid queue session.");
        setStatus("error");
        return;
      }

      setQueueData(result.data);
      setStatus(result.data.status);

      if (result.data.status === "waiting") {
        clearHeartbeat();
        timerRef.current = setInterval(() => {
          void refreshStatus(result.data.id);
        }, 15000);
        setWaitTime(Math.ceil(Number(result.data.lanePosition || result.data.position || 0) * 0.3));
        return;
      }

      if (result.data.status === "admitted") {
        persistAdmissionToken(eventId, result.data.token);
        router.push(returnTo);
        return;
      }

      await refreshStatus(result.data.id);
    } catch (error) {
      setErrorMessage(error?.message || "We could not join the waiting room.");
      setStatus("error");
    }
  }, [clearHeartbeat, eventId, refreshStatus, returnTo, router, searchParams, toast, user]);

  useEffect(() => {
    if (!loading && eventId) {
      void join();
    }

    return () => {
      clearHeartbeat();
    };
  }, [clearHeartbeat, eventId, join, loading]);

  return {
    eventData,
    lowestPrice: useMemo(() => getStartingPrice(eventData), [eventData]),
    queueData,
    refreshPage: () => window.location.reload(),
    status,
    waitTime,
    errorMessage,
  };
}
