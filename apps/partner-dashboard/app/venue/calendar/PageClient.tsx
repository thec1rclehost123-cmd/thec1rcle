import { OperatingCalendar } from "@/components/calendar/OperatingCalendar";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";

export default function CalendarWrapper() {
    return (
        <VenuePageShell
            title="Calendar"
            subtitle="Manage availability, review slot requests and track your night schedule."
        >
            <OperatingCalendar />
        </VenuePageShell>
    );
}
