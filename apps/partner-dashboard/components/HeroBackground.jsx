import Link from "next/link";

export default function HeroBackground() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[40px] border border-white/10 bg-gradient-to-b from-white/5 via-transparent to-white/5 p-10 text-center shadow-glow">
      <p className="text-xs uppercase tracking-[0.7em] text-white/60">THE C1RCLE</p>
      <h1 className="text-4xl font-display uppercase leading-tight tracking-[0.2em]">Discover life offline</h1>
      <p className="max-w-2xl text-white/60">
        A curated set of campus nights, rooftop flows, and underground pop-ups inspired by global social drops but remixed for Gen Z
        India.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/explore" className="rounded-full bg-white px-6 py-2 text-xs uppercase tracking-[0.3em] text-black">Dive Into Explore</Link>
        <Link href="/create" className="rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.3em]">Create Event</Link>
      </div>
    </section>
  );
}
