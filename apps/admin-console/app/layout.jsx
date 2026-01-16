import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import AdminConsoleShell from "@/components/admin/AdminConsoleShell";

export const metadata = {
    title: "c1rcle | Authority Node",
    description: "Administrative Command Center",
};

export default function AdminLayout({ children }) {
    return (
        <html lang="en">
            <body className="antialiased">
                <AuthProvider>
                    <AdminConsoleShell>{children}</AdminConsoleShell>
                </AuthProvider>
            </body>
        </html>
    );
}
