import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import MobileBottomNav from "../components/MobileBottomNav";
import PageWrapper from "../components/PageWrapper";
import AppProviders from "../components/providers/AppProviders";
import ScrollProgressBar from "../components/ScrollProgressBar";
import PageLoadingAnimation from "../components/PageLoadingAnimation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata = {
  title: {
    default: "THE.C1RCLE",
    template: "THE.C1RCLE | %s"
  },
  description: "Discover Life Offline.",
  applicationName: "THE.C1RCLE",
  appleWebApp: {
    title: "THE.C1RCLE",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://thec1rcle.com",
    siteName: "THE.C1RCLE",
    title: {
      default: "THE.C1RCLE",
      template: "THE.C1RCLE | %s"
    },
    description: "Discover Life Offline.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "THE.C1RCLE"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: "THE.C1RCLE",
      template: "THE.C1RCLE | %s"
    },
    description: "Discover Life Offline.",
    creator: "@thec1rcle_in",
    images: ["/og-image.jpg"]
  },
  metadataBase: new URL("https://thec1rcle.com"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        <AppProviders>
          <PageLoadingAnimation />
          <ScrollProgressBar />
          <div className="page-shell relative min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-300">
            <div className="pointer-events-none fixed inset-0 -z-10 opacity-0 dark:opacity-90 transition-opacity duration-300">
              <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_55%)] blur-[120px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(136,69,255,0.18),transparent_55%)]" />
              <div className="absolute inset-x-0 bottom-0 h-[50vh] bg-[radial-gradient(circle_at_bottom,_rgba(255,181,167,0.2),transparent_50%)] blur-[140px]" />
            </div>
            <Navbar />
            <PageWrapper>{children}</PageWrapper>
            <MobileBottomNav />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
