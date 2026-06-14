import EventTeamClient from "@/components/event-detail/EventTeamClient";

export const metadata = { title: "Event Team — Venue" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EventTeamClient eventId={id} />;
}
