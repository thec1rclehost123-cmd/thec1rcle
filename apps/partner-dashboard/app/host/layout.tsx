import { HostClientWrapper } from "@/components/layout/HostClientWrapper";

export default function HostLayout({ children }: { children: React.ReactNode }) {
    return (
        <HostClientWrapper>
            {children}
        </HostClientWrapper>
    );
}
