import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getHostByHandle } from "../../../lib/server/hostStore";
import { listEvents } from "../../../lib/server/eventStore";
import EventGrid from "../../../components/EventGrid";
import { CheckCircle2 } from "lucide-react";

export default async function HostProfilePage({ params }) {
    const hostHandle = decodeURIComponent(params.hostHandle);
    const hostProfile = await getHostByHandle(hostHandle);

    if (!hostProfile) {
        notFound();
    }

    // Get all events and filter by this host
    const allEvents = await listEvents({ limit: 100 }); // Get a large number
    const hostEvents = allEvents.filter(event => event.host === hostHandle);

    return (
        <main className="px-4 pb-32 pt-8 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-10">
                {/* Host Header */}
                <div className="glass-panel rounded-[40px] border border-white/10 bg-black/60 p-8 text-white shadow-glow">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                        {/* Host Avatar */}
                        <div className="relative h-32 w-32 overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-white/10 to-white/5 flex-shrink-0">
                            <Image
                                src={hostProfile?.avatar || "/events/holi-edit.svg"}
                                alt={hostProfile?.name || hostHandle}
                                fill
                                className="object-cover"
                            />
                        </div>

                        {/* Host Info */}
                        <div className="flex-1 space-y-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-white/40">Host</p>
                                <h1 className="mt-2 text-4xl font-display uppercase tracking-[0.2em] font-black">
                                    {hostProfile?.name || hostHandle.replace("@", "")}
                                    {hostProfile?.verified && (
                                        <CheckCircle2 className="inline-block ml-2 h-6 w-6 text-blue-400" fill="currentColor" stroke="black" />
                                    )}
                                </h1>
                                <p className="mt-2 text-lg text-white/60">{hostHandle}</p>
                            </div>

                            <div className="flex flex-wrap gap-6 text-sm text-white/60">
                                <div>
                                    <span className="font-semibold text-white">{hostProfile?.followers || "0"}</span> Followers
                                </div>
                                <div>
                                    <span className="font-semibold text-white">{hostProfile?.location || "India"}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-white">{hostEvents.length}</span> Events
                                </div>
                            </div>

                            <p className="text-base text-white/70 max-w-2xl">
                                {hostProfile?.bio || "Building community nights across India."}
                            </p>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3 pt-4">
                                <button
                                    type="button"
                                    className="rounded-full bg-white px-6 py-3 text-xs uppercase tracking-[0.35em] text-black transition hover:bg-white/90 font-bold"
                                >
                                    Follow
                                </button>
                                <button
                                    type="button"
                                    className="rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/80 transition hover:border-white/60 font-bold"
                                >
                                    Message
                                </button>
                                <button
                                    type="button"
                                    className="rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/80 transition hover:border-white/60 font-bold"
                                >
                                    Share Profile
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Host's Events */}
                <div>
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-2xl font-heading uppercase tracking-[0.3em] text-white font-bold">
                            Events by {hostProfile?.name || hostHandle}
                        </h2>
                        <p className="text-sm text-white/60">
                            {hostEvents.length} {hostEvents.length === 1 ? 'event' : 'events'}
                        </p>
                    </div>

                    {hostEvents.length > 0 ? (
                        <EventGrid events={hostEvents} />
                    ) : (
                        <div className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-12 text-center shadow-glow">
                            <p className="text-lg text-white/60">No events yet</p>
                            <p className="mt-2 text-sm text-white/40">
                                {hostProfile?.name || hostHandle} hasn't created any events yet.
                            </p>
                            <Link
                                href="/explore"
                                className="mt-6 inline-block rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.35em] text-white/80 transition hover:border-white/60"
                            >
                                Browse All Events
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main >
    );
}
