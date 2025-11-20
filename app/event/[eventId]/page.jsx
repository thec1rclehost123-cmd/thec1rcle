import { notFound } from "next/navigation";
import EventRSVP from "../../../components/EventRSVP";
import { getEvent } from "../../../lib/server/eventStore";
import { getHostProfile } from "../../../data/hosts";

export default async function EventDetailPage({ params }) {
  const identifier = decodeURIComponent(params.eventId);
  const event = await getEvent(identifier);
  if (!event) {
    notFound();
  }
  const hostProfile = getHostProfile(event.host);
  return <EventRSVP event={event} host={hostProfile} />;
}
