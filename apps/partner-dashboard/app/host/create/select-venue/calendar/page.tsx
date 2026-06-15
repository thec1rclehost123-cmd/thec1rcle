import { HostVenueCalendar } from '@/components/host-events/HostVenueCalendar';

export const metadata = {
  title: 'Select Time Slot | THE C1RCLE',
};

export default function SelectSlotPage() {
  return (
    <div className="py-8">
      <HostVenueCalendar />
    </div>
  );
}
