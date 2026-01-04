import "./globals.css";
import { Inter } from "next/font/google";
import { DashboardAuthProvider } from "../components/providers/DashboardAuthProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata = {
  title: {
    default: "c1rcle Dashboards",
    template: "%s | c1rcle Dashboards"
  },
  description: "Digital Operating System for Nightlife Businesses",
  applicationName: "c1rcle Dashboards",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        <DashboardAuthProvider>
          {children}
        </DashboardAuthProvider>
      </body>
    </html>
  );
}
