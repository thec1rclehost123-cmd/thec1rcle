'use client';

import { motion } from 'framer-motion';
import { useAppWaitlist } from '../hooks/useAppWaitlist';

export default function AppWaitlistSection() {
  const { email, joined, loading, handleJoin, setEmail } = useAppWaitlist();

  return (
    <section
      id="waitlist"
      className="relative flex h-screen items-center justify-center overflow-hidden bg-[#F44A22]"
    >
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-40 mix-blend-overlay" />

      <div className="relative z-10 w-full max-w-4xl px-6 text-center">
        <h2 className="mb-12 text-[12vw] font-black uppercase leading-[0.8] tracking-tighter text-black">
          GET IN
          <br />
          THE C1RCLE
        </h2>

        {joined ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block rounded-3xl bg-black p-8 shadow-2xl"
          >
            <span className="text-2xl font-black uppercase tracking-wider text-white">
              Welcome to the list.
            </span>
          </motion.div>
        ) : (
          <form
            onSubmit={handleJoin}
            className="flex transform flex-col items-stretch gap-2 rounded-[2rem] bg-black p-2 shadow-2xl transition-transform duration-300 hover:scale-105 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-4"
          >
            <input
              type="email"
              placeholder="ENTER YOUR EMAIL"
              className="w-full bg-transparent px-6 py-4 text-center text-lg font-bold uppercase tracking-wider text-white placeholder-white/40 focus:outline-none sm:flex-1 sm:px-8 sm:text-left sm:text-xl"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full whitespace-nowrap rounded-full bg-white px-8 py-4 text-lg font-black uppercase tracking-wider text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-12 sm:py-6"
            >
              {loading ? 'Joining...' : 'Join Now'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
