import Link from "next/link";

export default function ProfileCard({ username }) {
  return (
    <section className="mb-10 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-white/10 via-black to-black p-6 text-center">
      <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-white/10" />
      <h1 className="text-2xl font-display">{username}</h1>
      <p className="text-sm text-white/60">42 events · 9 months on THE C1RCLE</p>
      <div className="mt-4 flex justify-center gap-3">
        <button className="rounded-full bg-white px-6 py-2 text-xs uppercase tracking-[0.3em] text-black">Follow</button>
        <Link href="/explore" className="rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.3em]">Share</Link>
      </div>
    </section>
  );
}
