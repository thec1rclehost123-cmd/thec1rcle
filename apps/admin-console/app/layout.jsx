import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import AdminConsoleShell from "@/components/admin/AdminConsoleShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { WebVitals } from "@/components/WebVitals";

export const metadata = {
    title: "c1rcle | Authority Node",
    description: "Administrative Command Center",
};

export default function AdminLayout({ children }) {
    return (
        <html lang="en">
            <body className="antialiased">
                <WebVitals />
                <QueryProvider>
                    <AuthProvider>
                        <AdminConsoleShell>{children}</AdminConsoleShell>
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
