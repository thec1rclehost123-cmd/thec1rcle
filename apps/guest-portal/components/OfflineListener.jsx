"use client";

import { useEffect, useState } from "react";
import { useToast } from "./providers/ToastProvider";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineListener() {
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      toast({
        type: "error",
        message: "You are currently offline. Some features may be unavailable.",
        duration: 5000,
      });
    };

    const handleOnline = () => {
      if (isOffline) {
        setIsOffline(false);
        toast({
          type: "success",
          message: "Back online! Syncing your latest updates.",
          duration: 3000,
        });
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isOffline, toast]);

  return null;
}
