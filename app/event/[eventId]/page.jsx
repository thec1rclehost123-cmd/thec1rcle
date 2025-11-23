import { notFound } from "next/navigation";
import EventRSVP from "../../../components/EventRSVP";
import { getEvent } from "../../../lib/server/eventStore";
import { getHostProfile } from "../../../data/hosts";


export async function generateMetadata({ params }) {
  const identifier = decodeURIComponent(params.eventId);
  const event = await getEvent(identifier);

  if (!event) {
    return {
      title: "Event Not Found",
      description: "The event you are looking for does not exist."
    };
  }

  const title = event.title.toUpperCase();
  const description = event.summary || event.description || "Join us at THE C1RCLE.";
  const images = event.image ? [event.image] : [];

  return {
    title: title,
    description: description,
    openGraph: {
      title: `THE.C1RCLE | ${title}`,
      description: description,
      images: images,
      siteName: "THE.C1RCLE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `THE.C1RCLE | ${title}`,
      description: description,
      images: images,
    }
  };
}

export default async function EventDetailPage({ params }) {
  const identifier = decodeURIComponent(params.eventId);
  const event = await getEvent(identifier);
  if (!event) {
    notFound();
  }
  const hostProfile = getHostProfile(event.host);
  return <EventRSVP event={event} host={hostProfile} />;
}
