"use client";

import AuthProvider from "./AuthProvider";

export default function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
