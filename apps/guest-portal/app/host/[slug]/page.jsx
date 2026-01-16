import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getHostBySlug } from "../../../lib/server/hostStore";
import { getProfilePosts, getProfileHighlights, getProfileStats } from "../../../lib/server/partnerProfileStore";
import { listEvents } from "../../../lib/server/eventStore";
import { CheckCircle2, MapPin, Heart, ExternalLink, Instagram, Music, Play, Calendar, Users, Eye, ChevronRight } from "lucide-react";
import ProfileClient from "../../venue/[slug]/ProfileClient";

export const revalidate = 60;

export async function generateMetadata({ params }) {
    const { slug } = params;
    const host = await getHostBySlug(slug);
    if (!host) return { title: "Host Not Found" };

    return {
        title: `${host.name || host.displayName} | THE C1RCLE`,
        description: host.bio || `Discover events by ${host.name} on THE C1RCLE`,
        openGraph: {
            title: `${host.name || host.displayName} | THE C1RCLE`,
            description: host.bio || `Discover events by ${host.name}`,
            images: [host.coverURL || host.cover || "/og-default.jpg"],
        },
    };
}

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
    const pastEvents = hostEvents.filter(e => new Date(e.startDate || e.startAt) <= new Date()).slice(0, 6);

    // Normalize host object to match ProfileClient expectations
    const hostProfile = {
        ...host,
        photoURL: host.avatar || host.photoURL,
        coverURL: host.cover || host.coverURL,
        description: host.bio,
        genres: host.genres || [],
        styleTags: host.styleTags || [],
        videos: host.videos || []
    };

    return (
        <main className="min-h-screen bg-[#0A0A0A] text-white selection:bg-white selection:text-black">
            {/* Hero Section - Premium Identity Layer */}
            <div className="relative min-h-[70vh] w-full overflow-hidden">
                {/* Background Image with Parallax Effect */}
                <div className="absolute inset-0">
                    <Image
                        src={hostProfile.coverURL || "/events/neon-nights.jpg"}
                        alt={hostProfile.name}
                        fill
                        priority
                        className="object-cover opacity-40 scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-[#0A0A0A]/60 to-[#0A0A0A]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 via-transparent to-[#0A0A0A]/80" />
                </div>

                {/* Noise Texture */}
                <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")`
                }} />

                {/* Content */}
                <div className="relative z-10 h-full flex items-end pb-16 pt-32">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 w-full">
                        <div className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-12">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                <div className="w-36 h-36 lg:w-48 lg:h-48 rounded-3xl overflow-hidden border-2 border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl">
                                    <Image
                                        src={hostProfile.photoURL || "/events/holi-edit.svg"}
                                        alt={hostProfile.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                {hostProfile.verified && (
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
                                        <CheckCircle2 className="h-6 w-6 text-black" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 space-y-6">
                                {/* Role Badge & Genres */}
                                <div className="flex flex-wrap items-center gap-3">
                                    {hostProfile.role && (
                                        <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                                            {hostProfile.role}
                                        </span>
                                    )}
                                    {hostProfile.genres?.slice(0, 3).map((genre, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-orange/20 rounded-full text-[10px] font-bold uppercase tracking-wider text-orange">
                                            {genre}
                                        </span>
                                    ))}
                                </div>

                                {/* Name */}
                                <div className="space-y-3">
                                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9]">
                                        {hostProfile.name || hostProfile.displayName}
                                    </h1>

                                    {hostProfile.tagline && (
                                        <p className="text-xl md:text-2xl font-medium text-white/50 max-w-2xl">
                                            {hostProfile.tagline}
                                        </p>
                                    )}
                                </div>

                                {/* Location & Handle */}
                                <div className="flex items-center gap-6 text-white/50 text-sm font-bold uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {hostProfile.city || hostProfile.location || "India"}
                                    </div>
                                    <span className="h-1 w-1 rounded-full bg-white/20" />
                                    <span className="text-white/30">@{hostProfile.slug || slug}</span>
                                </div>

                                {/* Stats Row */}
                                <div className="flex gap-10 pt-4">
                                    <div className="text-center">
                                        <p className="text-3xl md:text-4xl font-black">{(stats.followersCount || 0).toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">Followers</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl md:text-4xl font-black">{upcomingEvents.length}</p>
                                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">Upcoming</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl md:text-4xl font-black">{hostEvents.length}</p>
                                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mt-1">Total Events</p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3 lg:pb-4">
                                <button className="px-10 py-4 bg-white text-black rounded-full text-xs font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]">
                                    Follow
                                </button>
                                {hostProfile.socialLinks?.instagram && (
                                    <a
                                        href={`https://instagram.com/${hostProfile.socialLinks.instagram}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-10 py-4 bg-white/10 backdrop-blur-md text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10"
                                    >
                                        <Instagram className="w-4 h-4" />
                                        Instagram
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bio Section */}
            {hostProfile.bio && (
                <section className="py-16 border-t border-white/5">
                    <div className="max-w-4xl mx-auto px-6 sm:px-12 lg:px-24">
                        <p className="text-lg md:text-xl leading-relaxed text-white/70 font-medium">
                            {hostProfile.bio}
                        </p>
                    </div>
                </section>
            )}

            {/* Style Tags */}
            {hostProfile.styleTags?.length > 0 && (
                <section className="pb-12">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="flex flex-wrap gap-3">
                            {hostProfile.styleTags.map((tag, idx) => (
                                <span key={idx} className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
                <section className="py-16 border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Upcoming Events</h2>
                                <p className="text-white/40 text-sm font-medium mt-2">Don't miss what's next</p>
                            </div>
                            <Link href="/explore" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                                View All <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {upcomingEvents.slice(0, 6).map((event) => (
                                <Link key={event.id} href={`/event/${event.id}`} className="group">
                                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                        <Image
                                            src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                            alt={event.name}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                        <div className="absolute inset-x-0 bottom-0 p-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="px-3 py-1 bg-orange rounded-full text-[10px] font-black uppercase tracking-wider text-white">
                                                    {new Date(event.startDate || event.startAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-1 line-clamp-2">{event.name}</h3>
                                            <p className="text-white/50 text-sm font-medium">{event.venueName || "Venue TBA"}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Videos Section */}
            {hostProfile.videos?.length > 0 && (
                <section className="py-16 border-t border-white/5 bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Videos & Recaps</h2>
                                <p className="text-white/40 text-sm font-medium mt-2">Aftermovies and performances</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {hostProfile.videos.map((video, idx) => (
                                <a key={idx} href={video.url} target="_blank" rel="noopener noreferrer" className="group">
                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange/20 to-purple-600/20 flex items-center justify-center">
                                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            </div>
                                        </div>
                                        <span className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest text-white/80">
                                            {video.type}
                                        </span>
                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                                            <h4 className="text-sm font-bold text-white">{video.title}</h4>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Posts & Highlights - Using Shared ProfileClient */}
            <ProfileClient
                upcomingEvents={upcomingEvents}
                posts={posts}
                highlights={highlights}
                venue={hostProfile}
            />

            {/* Past Events Gallery */}
            {pastEvents.length > 0 && (
                <section className="py-16 border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                        <div className="mb-10">
                            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Past Events</h2>
                            <p className="text-white/40 text-sm font-medium mt-2">A look back at previous experiences</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {pastEvents.map((event) => (
                                <Link key={event.id} href={`/event/${event.id}`} className="group">
                                    <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10">
                                        <Image
                                            src={event.image || event.coverImage || "/events/neon-nights.jpg"}
                                            alt={event.name}
                                            fill
                                            className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                        />
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Social Links Footer */}
            <section className="py-16 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {hostProfile.socialLinks?.instagram && (
                            <a
                                href={`https://instagram.com/${hostProfile.socialLinks.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Instagram className="w-4 h-4" /> Instagram
                            </a>
                        )}
                        {hostProfile.socialLinks?.soundcloud && (
                            <a
                                href={hostProfile.socialLinks.soundcloud}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Music className="w-4 h-4" /> SoundCloud
                            </a>
                        )}
                        {hostProfile.website && (
                            <a
                                href={hostProfile.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" /> Website
                            </a>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
