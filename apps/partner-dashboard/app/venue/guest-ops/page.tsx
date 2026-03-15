import { redirect } from "next/navigation";

export default function GuestOpsRoot({ searchParams }: { searchParams: Record<string, string> }) {
    const params = new URLSearchParams(searchParams).toString();
    redirect(`/venue/guest-ops/overview${params ? `?${params}` : ""}`);
}
