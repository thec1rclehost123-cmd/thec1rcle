import "./globals.css";
import { DashboardAuthProvider } from "../components/providers/DashboardAuthProvider";

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
      <body className="antialiased">
        <DashboardAuthProvider>
          {children}
        </DashboardAuthProvider>
      </body>
    </html>
  );
}
