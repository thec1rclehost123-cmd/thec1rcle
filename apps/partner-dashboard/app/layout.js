import "./globals.css";
import { DashboardAuthProvider } from "../components/providers/DashboardAuthProvider";
import ThemeProvider from "../components/providers/ThemeProvider";

export const metadata = {
  title: {
    default: "THE C1RCLE | Partner Dashboard",
    template: "%s | THE C1RCLE"
  },
  description: "Enterprise Partner Dashboard for Nightlife Venues, Hosts & Promoters",
  applicationName: "THE C1RCLE Partner Dashboard",
  keywords: ["nightclub", "venue management", "event management", "nightlife", "partner dashboard"],
  authors: [{ name: "THE C1RCLE" }],
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" }
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="c1rcle-theme"
        >
          <DashboardAuthProvider>
            {children}
          </DashboardAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
