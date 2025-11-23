"use client";

import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import { ToastProvider } from "./ToastProvider";

export default function AppProviders({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
