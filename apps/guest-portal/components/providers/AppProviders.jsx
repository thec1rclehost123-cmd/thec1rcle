"use client";

import { usePathname } from "next/navigation";
import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import ToastProvider from "./ToastProvider";
import { useAuth } from "./AuthProvider";
import GlobalAuthManager from "../GlobalAuthManager";
import OfflineListener from "../OfflineListener";
import CacheWarmer from "../CacheWarmer";
import ProfileCompletionPrompt from "../ProfileCompletionPrompt";

// Defers the ProfileCompletionPrompt dynamic chunk until auth is confirmed.
// Anonymous users (~70-80% of sessions) and checkout users never load this chunk.
function AuthGatedProfilePrompt() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (!user || loading) return null;
  if (pathname?.startsWith("/checkout")) return null;
  return <ProfileCompletionPrompt />;
}

export default function AppProviders({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <AuthProvider>
        <ToastProvider>
          <GlobalAuthManager />
          <OfflineListener />
          <CacheWarmer />
          <AuthGatedProfilePrompt />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
