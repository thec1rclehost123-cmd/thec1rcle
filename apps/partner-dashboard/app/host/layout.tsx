import { HostClientWrapper } from '@/components/layout/HostClientWrapper';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalErrorBoundary>
      <HostClientWrapper>{children}</HostClientWrapper>
    </GlobalErrorBoundary>
  );
}
