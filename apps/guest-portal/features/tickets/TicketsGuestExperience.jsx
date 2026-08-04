'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Crown, Heart, Ticket, User, Users } from 'lucide-react';

const TICKETS_DATA = [
  {
    id: 1,
    title: 'ACCESS',
    price: 'Free',
    icon: Ticket,
    color: 'bg-zinc-900',
    type: 'Standard',
  },
  {
    id: 2,
    title: 'MEMBER',
    price: 'Claim',
    icon: User,
    color: 'bg-zinc-900',
    type: 'Member',
  },
  {
    id: 3,
    title: 'VIP',
    price: '$45.00',
    icon: Crown,
    color: 'from-orange/20 to-orange/5 border-orange/20',
    type: 'VIP',
  },
  {
    id: 4,
    title: 'COUPLE',
    price: '$60.00',
    icon: Heart,
    color: 'bg-zinc-900',
    type: 'Standard',
  },
  {
    id: 5,
    title: 'SQUAD',
    price: '$120.00',
    icon: Users,
    color: 'bg-zinc-900',
    type: 'Standard',
  },
];

export function TicketsAuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
      <div className="absolute -top-[20%] left-0 h-[90vh] w-full bg-gradient-to-b from-orange/40 dark:from-iris/40 via-transparent to-transparent blur-[100px] opacity-[1.0] transition-colors duration-500" />
      <div className="absolute top-[10%] right-[-10%] h-[1400px] w-[1400px] rounded-full bg-orange/20 dark:bg-gold/20 blur-[120px] opacity-[1.0] mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute bottom-[5%] left-[-15%] h-[1000px] w-[1000px] rounded-full bg-iris/20 dark:bg-iris/30 blur-[100px] opacity-[1.0] mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute top-[45%] left-[30%] h-[800px] w-[1200px] rounded-full bg-orange/16 dark:bg-orange/20 blur-[140px] opacity-[1.0] mix-blend-multiply dark:mix-blend-screen" />
    </div>
  );
}

function TicketCarousel() {
  const [activeIndex, setActiveIndex] = useState(2);

  const handleNext = () => {
    setActiveIndex((previous) => (previous + 1 < TICKETS_DATA.length ? previous + 1 : 0));
  };

  const handlePrev = () => {
    setActiveIndex((previous) => (previous - 1 >= 0 ? previous - 1 : TICKETS_DATA.length - 1));
  };

  return (
    <div
      className="relative w-full h-[400px] sm:h-[500px] flex flex-col items-center justify-center"
      style={{ perspective: '1000px' }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative h-[450px] w-full flex justify-center items-center">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
          animate={{
            backgroundColor:
              TICKETS_DATA[activeIndex].type === 'VIP'
                ? 'rgba(255, 165, 0, 0.5)'
                : 'rgba(255, 255, 255, 0.2)',
            scale: [1, 1.3],
            opacity: [0.15, 0.45],
          }}
          transition={{
            scale: { duration: 8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
            opacity: { duration: 8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
            backgroundColor: { duration: 1 },
          }}
        />
        <AnimatePresence>
          {TICKETS_DATA.map((ticket, index) => {
            const offset = index - activeIndex;
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={ticket.id}
                layout
                onClick={() => setActiveIndex(index)}
                className={clsx(
                  'absolute w-[260px] h-[420px] rounded-[32px] cursor-pointer flex flex-col justify-between p-6 overflow-hidden',
                  'bg-gradient-to-br border shadow-2xl backdrop-blur-md',
                  isActive ? 'border-white/20 z-50' : 'border-white/5',
                  ticket.color.includes('from-') ? ticket.color : 'bg-zinc-900',
                )}
                style={{
                  boxShadow: isActive
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    : '0 10px 30px -10px rgba(0, 0, 0, 0.8)',
                }}
                initial={false}
                animate={{
                  x: offset * 140,
                  y: Math.abs(offset) * 40 + (isActive ? 0 : 20),
                  scale: 1 - Math.abs(offset) * 0.1,
                  rotateZ: offset * 12,
                  rotateY: offset * -15,
                  zIndex: 100 - Math.abs(offset),
                  opacity: Math.abs(offset) > 2.5 ? 0 : 1,
                }}
                whileHover={{
                  scale: isActive ? 1.05 : 1 - Math.abs(offset) * 0.1 + 0.05,
                  rotateY: offset * -5,
                  y: isActive ? -15 : Math.abs(offset) * 40,
                }}
              >
                <motion.div
                  className="absolute inset-x-0 top-0 h-[200%] w-[100%] bg-gradient-to-b from-transparent via-white/5 to-transparent -skew-y-12 pointer-events-none"
                  animate={{ y: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: index * 0.4 }}
                />

                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-[32px] border-2 border-orange/40 pointer-events-none"
                    animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.015, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}

                <div className="absolute inset-0 opacity-[0.03] bg-[url('/noise.svg')]" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                {[...Array(3)].map((_, sparkIndex) => (
                  <motion.div
                    key={sparkIndex}
                    className="absolute w-1 h-1 bg-white/20 rounded-full"
                    animate={{
                      y: [0, -40, 0],
                      x: [0, (sparkIndex - 1) * 20, 0],
                      opacity: [0, 0.5, 0],
                      scale: [0, 1.5, 0],
                    }}
                    transition={{
                      duration: 3 + sparkIndex,
                      repeat: Infinity,
                      delay: sparkIndex * 1,
                      ease: 'easeInOut',
                    }}
                    style={{
                      left: `${20 + sparkIndex * 30}%`,
                      top: `${40 + sparkIndex * 20}%`,
                    }}
                  />
                ))}

                <div className="relative flex justify-between items-start">
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500',
                      isActive
                        ? 'bg-white/10 border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                        : 'bg-white/5 border border-white/5',
                    )}
                  >
                    <ticket.icon
                      className={clsx(
                        'w-6 h-6 transition-all duration-500',
                        isActive
                          ? ticket.type === 'VIP'
                            ? 'text-orange animate-pulse'
                            : 'text-white'
                          : 'text-white/20',
                      )}
                    />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold tracking-[0.2em] text-white/40">
                      THE C1RCLE
                    </span>
                    <div className="h-0.5 w-8 bg-white/20 mt-1" />
                  </div>
                </div>

                <div className="relative text-center my-auto transform rotate-[-90deg] translate-y-4">
                  <h2
                    className={clsx(
                      ticket.title.length > 6 ? 'text-4xl md:text-6xl' : 'text-5xl md:text-7xl',
                      'font-heading font-black uppercase tracking-tighter whitespace-nowrap transition-all duration-500',
                      isActive ? 'text-white' : 'text-white/20',
                    )}
                  >
                    {ticket.title}
                  </h2>
                  {isActive && ticket.type === 'VIP' && (
                    <motion.div
                      className="absolute -inset-2 bg-orange/20 blur-xl rounded-full -z-10"
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>

                <div className="relative w-full">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">
                        Price
                      </p>
                      <p className="text-lg font-bold text-white">{ticket.price}</p>
                    </div>
                    <div className="h-8 w-12 rounded bg-white/10 flex items-center justify-center">
                      <div className="w-1 h-4 bg-white/20 mx-[1px]" />
                      <div className="w-0.5 h-3 bg-white/20 mx-[1px]" />
                      <div className="w-1.5 h-4 bg-white/20 mx-[1px]" />
                      <div className="w-0.5 h-2 bg-white/20 mx-[1px]" />
                    </div>
                  </div>

                  <div
                    className={clsx(
                      'w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-colors',
                      isActive ? 'bg-white text-black' : 'bg-white/10 text-white/60',
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {isActive ? 'Select Ticket' : 'View'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex gap-6 mt-8 z-50">
        <button
          onClick={(event) => {
            event.stopPropagation();
            handlePrev();
          }}
          className="w-12 h-12 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation();
            handleNext();
          }}
          className="w-12 h-12 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function TicketsGuestView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 w-full relative">
      <div className="relative w-full max-w-7xl grid lg:grid-cols-2 gap-16 items-center">
        <div className="relative w-full flex items-center justify-center lg:order-2">
          <TicketCarousel />
        </div>

        <div className="text-center lg:text-left flex flex-col items-center lg:items-start relative z-10 lg:order-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-heading font-black uppercase tracking-tighter text-black dark:text-white mb-6 leading-[0.85]">
              Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">
                Pass
              </span>{' '}
              <br />
              To The Circle
            </h2>

            <p className="text-sm font-medium text-black/60 dark:text-white/60 leading-relaxed max-w-md mb-10 mx-auto lg:mx-0">
              Secure your spot at exclusive events. Your digital wallet for instant access, live
              updates, and effortless entry.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto lg:mx-0">
              <Link
                href="/login"
                className="flex-1 group relative overflow-hidden px-8 py-4 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)]"
              >
                <span className="relative text-xs flex items-center justify-center gap-2">
                  Login to Access
                </span>
              </Link>
              <Link
                href="/login?mode=register"
                className="flex-1 px-8 py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-95 flex items-center justify-center"
              >
                <span className="text-xs">Sign Up</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
