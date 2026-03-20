import "./globals.css";
import { DashboardAuthProvider } from "../components/providers/DashboardAuthProvider";
import ThemeProvider from "../components/providers/ThemeProvider";
import { ToastProvider } from "../components/ui/Toast";
import { QueryProvider } from "../components/providers/QueryProvider";
import { WebVitals } from "../components/WebVitals";

export const dynamic = "force-dynamic";

export const metadata = {
  title: {
    default: "THE C1RCLE | Partner Dashboard",
    template: "%s | THE C1RCLE"
  },
  description: "Enterprise Partner Dashboard for Nightlife Venues, Hosts & Promoters",
  applicationName: "THE C1RCLE Partner Dashboard",
  keywords: ["nightclub", "venue management", "event management", "nightlife", "partner dashboard"],
  authors: [{ name: "THE C1RCLE" }],
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" }
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <WebVitals />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={true}
          storageKey="c1rcle-theme"
        >
          <QueryProvider>
            <DashboardAuthProvider>
              <ToastProvider position="top-center">
                {children}
              </ToastProvider>
            </DashboardAuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
