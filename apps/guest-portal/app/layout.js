import "./globals.css";
import { Inter } from "next/font/google";
import CheckoutAwareShell from "../components/CheckoutAwareShell";
import AppProviders from "../components/providers/AppProviders";
import { QueryProvider } from "../components/providers/QueryProvider";
import { WebVitals } from "../components/WebVitals";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: {
    default: "THE.C1RCLE",
    template: "THE.C1RCLE | %s",
  },
  description: "Discover Life Offline. The future of Indian nightlife.",
  applicationName: "THE.C1RCLE",
  appleWebApp: {
    title: "THE.C1RCLE",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#F44A22" }],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://thec1rcle.com",
    siteName: "THE.C1RCLE",
    title: {
      default: "THE.C1RCLE",
      template: "THE.C1RCLE | %s",
    },
    description: "Discover Life Offline. The future of Indian nightlife.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "THE.C1RCLE",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: "THE.C1RCLE",
      template: "THE.C1RCLE | %s",
    },
    description: "Discover Life Offline.",
    creator: "@thec1rcle_in",
    images: ["/og-image.jpg"],
  },
  metadataBase: new URL("https://thec1rcle.com"),
};

export const viewport = {
  themeColor: "#030303",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Removed force-dynamic — it was cascading to ALL routes, blocking the server.
// Individual pages/API routes that need dynamic rendering already declare it themselves.

import Navbar from "../components/Navbar";
import FooterContent from "../components/FooterContent";
import ContextualFooter from "../components/ContextualFooter";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        <WebVitals />
        <QueryProvider>
          <AppProviders>
            <CheckoutAwareShell
              navbar={<Navbar />}
              footer={<ContextualFooter footerContent={<FooterContent />} />}
            >
              {children}
            </CheckoutAwareShell>
          </AppProviders>
        </QueryProvider>
      </body>
    </html>
  );
}
