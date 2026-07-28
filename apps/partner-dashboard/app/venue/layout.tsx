import { VenueClientWrapper } from '@/components/layout/VenueClientWrapper';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

export default function VenueDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalErrorBoundary>
      <VenueClientWrapper>{children}</VenueClientWrapper>
    </GlobalErrorBoundary>
  );
}
