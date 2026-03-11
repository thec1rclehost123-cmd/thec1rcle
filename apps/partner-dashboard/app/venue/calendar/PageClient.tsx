import { OperatingCalendar } from "@/components/calendar/OperatingCalendar";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";

export default function CalendarWrapper() {
    return (
        <VenuePageShell
            title="Calendar"
            subtitle="Every event, every date — your venue's full schedule"
        >
            <div className="min-h-[calc(100vh-200px)]">
                <OperatingCalendar />
            </div>
        </VenuePageShell>
    );
}
