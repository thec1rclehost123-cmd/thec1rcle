import EventSettingsClient from "@/components/event-detail/EventSettingsClient";

export const metadata = { title: "Event Settings — Venue" };

export default async function EventSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EventSettingsClient eventId={id} />;
}
