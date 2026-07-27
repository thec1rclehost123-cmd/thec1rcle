import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import AdminConsoleShell from '@/components/admin/AdminConsoleShell';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { WebVitals } from '@/components/WebVitals';
import ToastProvider from '@/components/providers/ToastProvider';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'c1rcle | Authority Node',
  description: 'Administrative Command Center',
};

export default function AdminLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WebVitals />
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>
              <AdminConsoleShell>{children}</AdminConsoleShell>
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
