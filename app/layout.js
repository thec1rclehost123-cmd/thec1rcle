import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import MobileBottomNav from "../components/MobileBottomNav";
import RouteTransition from "../components/RouteTransition";
import AppProviders from "../components/providers/AppProviders";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata = {
  title: "THE C1RCLE India | Discover Life Offline",
  description: "A premium Gen Z India events platform to explore, create, and experience IRL moments."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="bg-black" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased bg-black text-white`}>
        <AppProviders>
          <div className="page-shell relative min-h-screen bg-black text-white">
            <div className="pointer-events-none fixed inset-0 -z-10 opacity-90">
              <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_55%)] blur-[120px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(136,69,255,0.18),transparent_55%)]" />
              <div className="absolute inset-x-0 bottom-0 h-[50vh] bg-[radial-gradient(circle_at_bottom,_rgba(255,181,167,0.2),transparent_50%)] blur-[140px]" />
            </div>
            <Navbar />
            <main className="px-4 pt-28 pb-24 sm:px-8 sm:pt-40 sm:pb-32">
              <RouteTransition>{children}</RouteTransition>
            </main>
            <MobileBottomNav />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
