import { getVenueBySlug } from "../../../../lib/server/venueStore";
import { notFound } from "next/navigation";
import MenuClient from "./MenuClient";

export default async function VenueMenuPage({ params }) {
    const { slug } = params;
    const venue = await getVenueBySlug(slug);
    if (!venue) notFound();

    return <MenuClient venue={venue} slug={slug} />;
}
