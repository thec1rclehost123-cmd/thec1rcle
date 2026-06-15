import Link from 'next/link';
import Navbar from '../Navbar';
import { Compass, ArrowRight, Sparkles } from 'lucide-react';

export default function PublicProfileUnavailable({ type = 'host', name }) {
  const label = type === 'venue' ? 'venue' : 'host';
  const title = name || `This ${label}`;

  return (
    <div className="min-h-screen bg-[#050507] text-white overflow-hidden">
      <Navbar />

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[#F44A22]/18 blur-[140px]" />
        <div className="absolute right-[8%] top-[28%] h-[22rem] w-[22rem] rounded-full bg-[#d5ff5c]/10 blur-[140px]" />
        <div className="absolute bottom-[-8rem] left-[10%] h-[24rem] w-[24rem] rounded-full bg-white/6 blur-[180px]" />
        <div
          className="absolute inset-0 opacity-[0.18] mix-blend-screen"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0, transparent 28%), radial-gradient(circle at 80% 35%, rgba(255,255,255,0.06) 0, transparent 24%)',
          }}
        />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 pb-16 pt-32 sm:px-10 lg:px-16">
        <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1.05fr)_360px] lg:items-end">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white/55">
              <Sparkles className="h-3.5 w-3.5 text-[#F44A22]" />
              Profile Offline
            </div>

            <div className="space-y-4">
              <p className="max-w-[12rem] text-[11px] font-black uppercase tracking-[0.38em] text-white/35">
                Public presence is currently switched off
              </p>
              <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.88] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                {title} doesn&apos;t have a public profile right now.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
                The page exists, but it has been taken off the public map for now. Explore other
                nights, other rooms, and other people shaping the circuit.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/explore"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#F44A22] px-7 py-3.5 text-[11px] font-black uppercase tracking-[0.24em] text-white transition hover:brightness-110"
              >
                Explore Events
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/hosts"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-7 py-3.5 text-[11px] font-black uppercase tracking-[0.24em] text-white/82 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Explore Others
                <Compass className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-2xl">
            <div className="mb-8 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/35">
                What now
              </p>
              <div className="h-px w-12 bg-white/10" />
            </div>

            <div className="space-y-5">
              {[
                {
                  title: 'See what is live tonight',
                  copy: 'Browse the public event feed and jump into what is already open.',
                },
                {
                  title: 'Find another host or venue',
                  copy: 'Discover other profiles that are still public and actively posting.',
                },
                {
                  title: 'Keep the branded link',
                  copy: 'This link still works, so the page can come back online without changing the URL.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-b border-white/8 pb-5 last:border-b-0 last:pb-0"
                >
                  <p className="mb-1 text-sm font-bold text-white">{item.title}</p>
                  <p className="text-sm leading-6 text-white/45">{item.copy}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
