"use client";

import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import ToastProvider from "./ToastProvider";
import GlobalAuthManager from "../GlobalAuthManager";
import OfflineListener from "../OfflineListener";

export default function AppProviders({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange={false}>
      <AuthProvider>
        <ToastProvider>
          <GlobalAuthManager />
          <OfflineListener />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
