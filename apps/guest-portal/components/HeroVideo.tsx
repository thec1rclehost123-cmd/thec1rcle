import HeroVideoOverlay from './HeroVideoOverlay';
import ReactDOM from 'react-dom';

export default function HeroVideo({ src, poster }: { src: string; poster?: string }) {
  // Preload the video file natively for the browser
  ReactDOM.preload(src, { as: 'video' });

  if (poster) {
    ReactDOM.preload(poster, { as: 'image' });
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {/* Background Video Layer — loads natively without waiting for JS */}
      <div className="absolute inset-0 h-full w-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={poster}
          width={1920}
          height={1080}
          className="h-full w-full object-cover scale-105"
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>

      {/* Multi-layered Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/90 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 z-[1]" />

      {/* Client-side Motion and Interactive Overlays */}
      <HeroVideoOverlay />

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 md:h-40 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none z-[1]" />

      {/* Decorative Glow Elements — static opacity, no animate-pulse (reduces continuous repaints) */}
      <div
        className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-[#F44A22] rounded-full blur-[100px] md:blur-[120px] opacity-15 pointer-events-none z-[0]"
        style={{ willChange: 'auto' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-purple-500 rounded-full blur-[100px] md:blur-[120px] opacity-10 pointer-events-none z-[0]"
        style={{ willChange: 'auto' }}
      />
    </div>
  );
}
