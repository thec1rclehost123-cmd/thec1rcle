"use client";

import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import ToastProvider from "./ToastProvider";
import GlobalAuthManager from "../GlobalAuthManager";

export default function AppProviders({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <ToastProvider>
          <GlobalAuthManager />
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
