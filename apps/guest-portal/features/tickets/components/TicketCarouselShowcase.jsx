import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Ticket as TicketIcon } from 'lucide-react';
import clsx from 'clsx';

export function TicketCarouselShowcase({ tickets }) {
  const [activeIndex, setActiveIndex] = useState(2);

  const next = () => setActiveIndex((prev) => (prev + 1) % tickets.length);
  const prev = () => setActiveIndex((prev) => (prev - 1 + tickets.length) % tickets.length);

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] flex flex-col items-center justify-center perspective-2000">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-orange/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative h-[480px] w-full flex justify-center items-center">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
          animate={{
            backgroundColor:
              tickets[activeIndex]?.type === 'VIP'
                ? 'rgba(255, 77, 34, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
            scale: [1, 1.2],
            opacity: [0.1, 0.3],
          }}
          transition={{
            scale: { duration: 10, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
            opacity: { duration: 10, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
            backgroundColor: { duration: 1 },
          }}
        />

        <AnimatePresence mode="popLayout">
          {tickets.map((ticket, index) => {
            const offset = index - activeIndex;
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={ticket.id}
                layout
                onClick={() => setActiveIndex(index)}
                className={clsx(
                  'absolute w-[280px] h-[440px] rounded-[32px] cursor-pointer flex flex-col justify-between p-7 overflow-hidden',
                  'bg-gradient-to-br border shadow-2xl backdrop-blur-xl',
                  isActive
                    ? 'border-white/20 z-50 ring-1 ring-white/10'
                    : 'border-white/5 opacity-40',
                  ticket.color.includes('from-') ? ticket.color : 'bg-zinc-900',
                )}
                style={{
                  boxShadow: isActive
                    ? '0 40px 80px -20px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 77, 34, 0.1)'
                    : '0 20px 40px -10px rgba(0, 0, 0, 0.8)',
                }}
                initial={false}
                animate={{
                  x: offset * 160,
                  y: Math.abs(offset) * 60 + (isActive ? -20 : 20),
                  scale: isActive ? 1.05 : 1 - Math.abs(offset) * 0.15,
                  rotateZ: offset * 18,
                  rotateY: offset * -25,
                  zIndex: 100 - Math.abs(offset),
                }}
                whileHover={{
                  y: isActive ? -35 : Math.abs(offset) * 60,
                  scale: isActive ? 1.08 : 1 - Math.abs(offset) * 0.15 + 0.02,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                }}
              >
                {/* Vertical Title background text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <span
                    className={clsx(
                      'text-[80px] md:text-[140px] font-black uppercase tracking-tighter leading-none transition-all duration-700',
                      'rotate-90 origin-center whitespace-nowrap',
                      isActive ? 'text-white opacity-20' : 'text-white/10 opacity-5',
                    )}
                  >
                    {ticket.title}
                  </span>
                </div>

                <motion.div
                  className="absolute inset-x-0 top-0 h-[200%] w-full bg-gradient-to-b from-transparent via-white/[0.03] to-transparent -skew-y-12 pointer-events-none"
                  animate={{ y: ['-100%', '100%'] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: index * 0.5,
                  }}
                />

                <div className="relative flex justify-between items-start">
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500',
                      isActive
                        ? 'bg-white/10 border border-white/20 shadow-lg'
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
                    <span className="text-[9px] font-black tracking-[0.4em] text-white/30 uppercase">
                      The C1rcle
                    </span>
                    <div className="h-px w-8 bg-white/20 mt-2" />
                  </div>
                </div>

                <div className="relative mt-auto">
                  {isActive ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-5"
                    >
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">
                            Price
                          </span>
                          <div className="text-2xl font-black text-white">{ticket.price}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <TicketIcon size={16} className="text-white/20" />
                        </div>
                      </div>
                      <button className="w-full py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.5em] transition-all hover:bg-orange hover:text-white shadow-xl">
                        Select Ticket
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col opacity-60">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">
                        Price
                      </span>
                      <div className="text-lg font-black text-white">{ticket.price}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Navigation Arrows */}
      <div className="flex items-center gap-6 mt-12 relative z-[60]">
        <button
          onClick={prev}
          className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={next}
          className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
