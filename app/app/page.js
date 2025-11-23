'use client';

import { useState, useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate, useInView } from 'framer-motion';
import Footer from '../../components/Footer';

// --- ASSETS ---
const VIDEOS = {
  hero: "https://cdn.coverr.co/videos/coverr-people-dancing-in-a-nightclub-5429/1080p.mp4",
  heatmap: "https://cdn.coverr.co/videos/coverr-driving-through-city-lights-at-night-4666/1080p.mp4",
  scanner: "https://cdn.coverr.co/videos/coverr-party-crowd-2662/1080p.mp4",
  vip: "https://cdn.coverr.co/videos/coverr-pouring-champagne-5393/1080p.mp4"
};

// --- COMPONENTS ---

const MagneticButton = ({ children, className = "" }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    x.set((clientX - centerX) * 0.3);
    y.set((clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      className={`relative group ${className}`}
    >
      {children}
    </motion.button>
  );
};

const FeatureCard = ({ title, subtitle, video, index, align }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center py-24 relative overflow-hidden">
      {/* Background Glow */}
      <div className={`absolute top-1/2 ${align === 'left' ? 'left-0' : 'right-0'} w-[50vw] h-[50vw] bg-[#F44A22] rounded-full blur-[150px] opacity-10 pointer-events-none`} />

      <div className="max-w-7xl w-full px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">

        {/* Text Content */}
        <motion.div
          style={{ opacity, x: align === 'left' ? -50 : 50 }}
          className={`flex flex-col ${align === 'right' ? 'lg:order-2 lg:items-end lg:text-right' : 'lg:items-start text-left'}`}
        >
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[#F44A22] font-mono text-xl">0{index}</span>
            <div className="h-[1px] w-20 bg-white/20" />
          </div>

          <h2 className="text-7xl md:text-9xl font-black text-white mb-8 leading-[0.85] tracking-tighter uppercase">
            {title}
          </h2>

          <p className="text-xl md:text-2xl text-white/60 max-w-lg leading-relaxed font-light mb-12">
            {subtitle}
          </p>

          <MagneticButton className="px-8 py-4 border border-white/20 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative z-10 text-white group-hover:text-black font-bold uppercase tracking-widest text-sm transition-colors duration-300">
              Experience It
            </span>
          </MagneticButton>
        </motion.div>

        {/* Visual Card */}
        <motion.div
          style={{ scale, y }}
          className={`relative aspect-[4/5] ${align === 'right' ? 'lg:order-1' : ''}`}
        >
          <div className="absolute inset-0 bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />

            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out"
            >
              <source src={video} type="video/mp4" />
            </video>

            {/* Floating UI Elements */}
            <div className="absolute bottom-8 left-8 right-8 z-20 transform translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-bold uppercase tracking-wider text-sm">Live Status</span>
                  <div className="w-2 h-2 bg-[#F44A22] rounded-full animate-pulse" />
                </div>
                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-[#F44A22]" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

const ManifestoLine = ({ children, className = "" }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });

  return (
    <motion.p
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.p>
  );
};

export default function AppPage() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    if (email) {
      setJoined(true);
      setEmail('');
      setTimeout(() => setJoined(false), 5000);
    }
  };

  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-black text-white selection:bg-[#F44A22] selection:text-black overflow-x-hidden">

      {/* --- HERO --- */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-50 scale-105">
            <source src={VIDEOS.hero} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
        </div>

        <div className="relative z-10 text-center px-6 mix-blend-difference">
          <motion.h1
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-[15vw] leading-[0.75] font-black tracking-tighter text-white uppercase mb-8"
          >
            THE C1RCLE
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="flex flex-col items-center gap-6"
          >
            <p className="text-2xl md:text-3xl font-light text-white uppercase tracking-[0.3em]">
              The Future of <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">Nightlife</span>
            </p>

            <div className="mt-8 flex gap-4">
              <MagneticButton className="px-10 py-5 bg-white text-black rounded-full font-black text-xl uppercase tracking-wider hover:scale-105 transition-transform">
                <span onClick={scrollToWaitlist}>Download App</span>
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- MANIFESTO --- */}
      <section className="py-32 px-6 bg-black relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <ManifestoLine className="text-4xl md:text-6xl font-black leading-tight text-white/90 uppercase">
            "The night is not just a time.<br />
            It's a <span className="text-[#F44A22]">place</span>."
          </ManifestoLine>
          <ManifestoLine className="mt-12 text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            We are rewriting the code of social interaction. No more guessing. No more waiting. Just pure, unfiltered connection with the people and places that match your energy.
          </ManifestoLine>
        </div>
      </section>

      {/* --- FEATURES --- */}
      <FeatureCard
        index={1}
        title="THE HEAT"
        subtitle="Real-time crowd density maps. See where the city is alive before you even leave your house."
        video={VIDEOS.heatmap}
        align="left"
      />

      <FeatureCard
        index={2}
        title="THE SCAN"
        subtitle="Augmented reality social discovery. Point your phone to see who's who. Connect on vibe instantly."
        video={VIDEOS.scanner}
        align="right"
      />

      <FeatureCard
        index={3}
        title="THE KEY"
        subtitle="Your digital identity is your access pass. Skip lines, unlock VIP areas, and own the night."
        video={VIDEOS.vip}
        align="left"
      />

      {/* --- CTA --- */}
      <section id="waitlist" className="relative h-screen flex items-center justify-center bg-[#F44A22] overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay" />

        <div className="relative z-10 max-w-4xl w-full px-6 text-center">
          <h2 className="text-[12vw] font-black text-black leading-[0.8] tracking-tighter mb-12 uppercase">
            GET IN<br />THE C1RCLE
          </h2>

          {joined ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black p-8 rounded-3xl shadow-2xl inline-block"
            >
              <span className="text-white font-black text-2xl uppercase tracking-wider">Welcome to the list.</span>
            </motion.div>
          ) : (
            <form onSubmit={handleJoin} className="bg-black p-4 rounded-full flex items-center shadow-2xl transform hover:scale-105 transition-transform duration-300">
              <input
                type="email"
                placeholder="ENTER YOUR EMAIL"
                className="flex-1 bg-transparent text-white px-8 py-4 focus:outline-none placeholder-white/40 font-bold text-xl uppercase tracking-wider min-w-0"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="bg-white text-black px-12 py-6 rounded-full font-black uppercase tracking-wider hover:bg-gray-200 transition-colors text-lg whitespace-nowrap">
                Join Now
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
