import { notFound } from "next/navigation";
import Image from "next/image";
import { getHostBySlug } from "../../../lib/server/hostStore";
import { getProfilePosts, getProfileHighlights, getProfileStats } from "../../../lib/server/partnerProfileStore";
import { listEvents } from "../../../lib/server/eventStore";
import { CheckCircle2, MapPin, Heart } from "lucide-react";
import ProfileClient from "../../venue/[slug]/ProfileClient"; // Reuse the client component as it's designed to be generic

export const revalidate = 60;

export default async function HostPublicPage({ params }) {
    const { slug } = params;

    // Fetch host details
    const host = await getHostBySlug(slug);
    if (!host) notFound();

    // Fetch posts, highlights, and stats
    const [posts, highlights, stats, allEvents] = await Promise.all([
        getProfilePosts(host.id, "host"),
        getProfileHighlights(host.id, "host"),
        getProfileStats(host.id, "host"),
        listEvents({ limit: 100 })
    ]);

    // Filter events for this host
    const hostEvents = allEvents.filter(e =>
        e.hostId === host.id ||
        e.host?.toLowerCase() === host.name?.toLowerCase() ||
        e.host === host.handle
    );

    const upcomingEvents = hostEvents.filter(e => new Date(e.startDate || e.startAt) > new Date());
    const pastEvents = hostEvents.filter(e => new Date(e.startDate || e.startAt) <= new Date())
        .sort((a, b) => new Date(b.startDate || b.startAt) - new Date(a.startDate || a.startAt));

    // Normalize host object to match ProfileClient expectations
    const hostProfile = {
        ...host,
        photoURL: host.avatar || host.photoURL,
        coverURL: host.cover || host.coverURL,
        description: host.bio
    };

    return (
        <main className="min-h-screen bg-[#0A0A0A] text-white selection:bg-white selection:text-black">
            {/* Identity Layer */}
            <div className="relative h-[40vh] min-h-[400px] w-full overflow-hidden">
                <Image
                    src={hostProfile.coverURL || "/events/neon-nights.jpg"}
                    alt={hostProfile.name}
                    fill
                    className="object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0A]/40 to-[#0A0A0A]" />

                <div className="absolute bottom-0 left-0 w-full px-6 pb-12 sm:px-12 lg:px-24">
                    <div className="flex flex-col md:flex-row md:items-end gap-8 max-w-7xl mx-auto">
                        <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-[2.5rem] overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl flex-shrink-0">
                            <Image
                                src={hostProfile.photoURL || "/events/holi-edit.svg"}
                                alt={hostProfile.name}
                                fill
                                className="object-cover"
                            />
                        </div>

                        <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">
                                        {hostProfile.name}
                                    </h1>
                                    {hostProfile.verified && (
                                        <CheckCircle2 className="h-6 w-6 text-white" fill="white" stroke="black" />
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-white/60 text-sm font-bold uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {hostProfile.location || "India"}
                                    </div>
                                    <span className="h-1 w-1 rounded-full bg-white/20" />
                                    <div className="text-white/40">@{hostProfile.slug}</div>
                                </div>
                            </div>

                            <p className="max-w-xl text-white/70 text-base leading-relaxed font-medium">
                                {hostProfile.bio || "Event host and culture curator."}
                            </p>

                            <div className="flex gap-8 pt-2">
                                <div className="flex flex-col">
                                    <span className="text-xl font-black">{stats.followersCount.toLocaleString()}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Followers</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-black">{hostEvents.length}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Total Events</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-black">{stats.totalLikes.toLocaleString()}</span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Highs</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pb-2">
                            <button className="px-10 py-4 bg-white text-black rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-glow">
                                Follow
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ProfileClient
                upcomingEvents={upcomingEvents}
                pastEvents={pastEvents}
                posts={posts}
                highlights={highlights}
                venue={hostProfile}
            />
        </main>
    );
}
