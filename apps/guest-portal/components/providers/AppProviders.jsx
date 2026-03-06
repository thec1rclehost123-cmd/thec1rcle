"use client";

import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import ToastProvider from "./ToastProvider";
import GlobalAuthManager from "../GlobalAuthManager";
import OfflineListener from "../OfflineListener";
import CacheWarmer from "../CacheWarmer";

export default function AppProviders({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <AuthProvider>
        <ToastProvider>
          <GlobalAuthManager />
          <OfflineListener />
          <CacheWarmer />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
