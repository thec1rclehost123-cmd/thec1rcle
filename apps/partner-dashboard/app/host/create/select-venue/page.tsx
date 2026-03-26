import { HostVenueSelectionGrid } from "@/components/host-events/HostVenueSelectionGrid";

export const metadata = {
    title: "Select Venue | THE C1RCLE",
};

export default function SelectVenuePage() {
    return (
        <div className="py-8">
            <HostVenueSelectionGrid />
        </div>
    );
}
