import { getVenueBySlug } from "../../../../lib/server/venueStore";
import { notFound } from "next/navigation";
import MenuClient from "./MenuClient";
import PublicProfileUnavailable from "../../../../components/profile/PublicProfileUnavailable";
import { isPublicProfileEnabled } from "../../../../lib/server/publicProfile";

export default async function VenueMenuPage({ params }) {
    const { slug } = params;
    const venue = await getVenueBySlug(slug);
    if (!venue) notFound();
    if (!isPublicProfileEnabled(venue)) {
        return <PublicProfileUnavailable type="venue" name={venue.name} />;
    }

    return <MenuClient venue={venue} slug={slug} />;
}
