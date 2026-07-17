'use client';

import Link from 'next/link';

export default function HeroVideoOverlay() {
  return (
    <>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scale-x-reveal {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes bounce-custom {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(16px);
          }
        }
        @keyframes pulse-custom {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-scale-in {
          animation: scale-in 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-scale-x-reveal {
          animation: scale-x-reveal 0.8s ease-out forwards;
          transform-origin: center;
          transform: scaleX(0);
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-bounce-custom {
          animation: bounce-custom 2s ease-in-out infinite;
        }
        .animate-pulse-custom {
          animation: pulse-custom 2s ease-in-out infinite;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }
        .delay-200 {
          animation-delay: 0.2s;
        }
        .delay-400 {
          animation-delay: 0.4s;
        }
        .delay-500 {
          animation-delay: 0.5s;
        }
        .delay-600 {
          animation-delay: 0.6s;
        }
        .delay-700 {
          animation-delay: 0.7s;
        }
        .delay-2000 {
          animation-delay: 2s;
        }

        /* Respect reduced motion — stop all continuous animations */
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up,
          .animate-scale-in,
          .animate-scale-x-reveal,
          .animate-fade-in,
          .animate-bounce-custom,
          .animate-pulse-custom {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Animated Film Grain Texture - Low opacity for mobile performance */}
      <div className="absolute inset-0 z-[1] opacity-[0.03] mix-blend-overlay pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
      </div>

      {/* Hero Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10 pt-16 md:pt-32">
        <div className="relative max-w-7xl space-y-6 md:space-y-12 w-full animate-fade-in-up delay-100">
          {/* Main Title - THE C1RCLE with Premium Effects */}
          <div className="relative">
            <h1
              className="text-[3.5rem] sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] font-heading font-black tracking-tighter leading-[0.9] animate-scale-in delay-200"
              style={{
                background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation:
                  'gradient-shift 15s ease-in-out infinite, scale-in 0.8s ease-out 0.2s forwards',
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
              }}
            >
              THE C1RCLE
            </h1>

            {/* Glowing Accent Lines */}
            <div className="absolute -bottom-4 md:-bottom-6 left-1/2 -translate-x-1/2 w-24 md:w-32 h-1 bg-gradient-to-r from-transparent via-[#F44A22] to-transparent shadow-[0_0_20px_rgba(244,74,34,0.8)] animate-scale-x-reveal delay-400" />
          </div>

          {/* Subtitle with Enhanced Glass Effect */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-full px-6 py-3 md:px-10 md:py-5 inline-block shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-fade-in-up delay-500">
            <p className="text-xs md:text-2xl text-white font-bold tracking-[0.2em] md:tracking-[0.4em] uppercase">
              Discover Life Offline
            </p>
          </div>

          {/* Description */}
          <p className="text-sm md:text-lg text-white/70 max-w-[280px] md:max-w-2xl mx-auto font-medium leading-relaxed px-2 animate-fade-in delay-600">
            Curated campus nights, rooftop flows, and underground pop-ups —
            <br className="hidden md:block" />
            remixed for Gen Z India
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-8 md:pb-0 animate-fade-in-up delay-700">
            <Link
              href="/explore"
              className="group relative px-8 py-4 md:px-10 md:py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] w-full sm:w-auto text-center"
            >
              <span className="relative z-10">Explore Events</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>
        </div>
      </div>

      {/* Enhanced Scroll Indicator - Positioned higher for mobile browsers */}
      <div className="absolute bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20 animate-fade-in delay-2000">
        <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-white/50 font-bold">
          Scroll Down
        </span>
        <div className="w-5 h-9 md:w-6 md:h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2 animate-pulse-custom">
          <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-white animate-bounce-custom" />
        </div>
      </div>
    </>
  );
}
