import { OperatingCalendar } from "@/components/calendar/OperatingCalendar";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";

export default function CalendarWrapper() {
    return (
        <VenuePageShell
            title="Calendar"
        >
            <OperatingCalendar />
        </VenuePageShell>
    );
}
