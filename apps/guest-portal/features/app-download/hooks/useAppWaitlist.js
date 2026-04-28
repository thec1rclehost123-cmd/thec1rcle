"use client";

import { useState } from "react";
import { joinAppWaitlist } from "../api/waitlistApi";

export function useAppWaitlist() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (event) => {
    event.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await joinAppWaitlist(email);
      setJoined(true);
      setEmail("");
      window.setTimeout(() => setJoined(false), 5000);
    } catch (error) {
      console.error("Error joining waitlist:", error);
      window.alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    joined,
    loading,
    handleJoin,
    setEmail,
  };
}
