import { VenueClientWrapper } from "@/components/layout/VenueClientWrapper";

export default function VenueDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <VenueClientWrapper>
            {children}
        </VenueClientWrapper>
    );
}
