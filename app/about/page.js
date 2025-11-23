"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useScroll, useTransform, useInView } from "framer-motion";
import { AnimatePresence } from "framer-motion";

// --- Data ---

const features = [
  {
    id: "composer",
    title: "Create Timeless Events",
    subtitle: "In Under a Minute",
    description: "Encapsulate your vision with images, music, and lightning-fast flows. The most powerful editor in the game.",
    color: "orange",
    visual: "ComposerUI"
  },
  {
    id: "growth",
    title: "Grow Your Community",
    subtitle: "Like Clockwork",
    description: "Automated SMS nudges, affiliate boosts, and waitlist pings. Sell out every drop without the manual hustle.",
    color: "silver",
    visual: "GrowthUI"
  },
  {
    id: "capital",
    title: "Instant Access to Capital",
    subtitle: "Financial Flexibility",
    description: "Track payouts in real-time. Unlock splits for your crew. No waiting for settlement to fund your production.",
    color: "grey",
    visual: "CapitalUI"
  },
  {
    id: "analytics",
    title: "Understand Your Audience",
    subtitle: "Powerful Analytics",
    description: "Drill into location heatmaps, demographic charts, and guest actions. Own your data.",
    color: "stone",
    visual: "AnalyticsUI"
  }
];

const useCases = [
  { title: "College", subtitle: "Greek Life, House Parties", image: "/events/campus.svg" },
  { title: "Arts", subtitle: "Galleries, Performances", image: "/events/select-art.svg" },
  { title: "Nightlife", subtitle: "Clubs, Underground", image: "/events/genz-night.svg" },
  { title: "Community", subtitle: "Meetups, Interests", image: "/events/interview-crew.svg" },
  { title: "Sports", subtitle: "Watch Parties, Rec Leagues", image: "/events/yoga.svg" }
];

const faqs = [
  { question: "What makes The C1rcle different?", answer: "We are the only platform that combines ticketing, CRM, and financial tools into one seamless operating system designed for the next generation of creators." },
  { question: "Is it easy to switch?", answer: "Yes. Our onboarding team will migrate your data, set up your first event, and train your team in under 24 hours." },
  { question: "Are there fees?", answer: "We make money when you do. Our fee structure is transparent and can be passed on to attendees." },
  { question: "How do payouts work?", answer: "Instant. As soon as a ticket is sold, the funds are available in your dashboard. No holding periods." }
];

// --- Components ---

import { useAuth } from "../../components/providers/AuthProvider";
import HostVerificationForm from "../../components/HostVerificationForm";
import { useRouter } from "next/navigation";

export default function AboutPage() {
  const [showHostModal, setShowHostModal] = useState(false);
  const { user, profile } = useAuth();
  const router = useRouter();

  const handleHostAccess = () => {
    if (!user) {
      router.push("/login?next=/about");
      return;
    }
    if (profile?.hostStatus === "approved") {
      router.push("/profile"); // Or host dashboard
      return;
    }
    setShowHostModal(true);
  };

  return (
    <div className="-mx-4 -mt-28 sm:-mx-8 sm:-mt-40 min-h-screen bg-black text-white selection:bg-iris/30 overflow-x-hidden">
      <BackgroundGrid />

      <div className="relative z-10">
        <HeroSection />
        <FeatureShowcase />
        <NetworkSection />
        <UseCasesSection />
        <FAQSection />
        <HostAccessSection onAccess={handleHostAccess} />
        <CTASection />
      </div>

      <AnimatePresence>
        {showHostModal && (
          <HostModal onClose={() => setShowHostModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function HostModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors z-10"
        >
          ✕
        </button>
        <HostVerificationForm onClose={onClose} />
      </motion.div>
    </div>
  );
}

function HostAccessSection({ onAccess }) {
  return (
    <section className="py-24 px-6 border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="space-y-4 text-center md:text-left">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold">
            Are you an Event Producer?
          </h2>
          <p className="text-white/60 max-w-md">
            Join our curated network of hosts. Get access to advanced tools, analytics, and our exclusive community.
          </p>
        </div>
        <button
          onClick={onAccess}
          className="group relative px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-widest text-xs overflow-hidden"
        >
          <span className="relative z-10 group-hover:text-white transition-colors duration-300">Host Access</span>
          <div className="absolute inset-0 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </button>
      </div>
    </section>
  );
}

function BackgroundGrid() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
    </div>
  );
}

function HeroSection() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 200]);

  return (
    <section className="relative h-[110vh] flex flex-col items-center justify-center px-6 overflow-hidden">
      <motion.div
        style={{ y }}
        className="text-center space-y-10 max-w-6xl mx-auto relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <h1 className="font-heading text-7xl sm:text-9xl font-black tracking-tighter text-white leading-[0.85] mix-blend-overlay opacity-90">
            BUILD THE<br />IMPOSSIBLE
          </h1>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-orange via-white to-orange-400 opacity-30 blur-[100px] -z-10"
            animate={{ scale: [0.8, 1.2, 0.8], rotate: [0, 45, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="max-w-2xl mx-auto text-xl sm:text-2xl text-white/60 font-light leading-relaxed"
        >
          The operating system for the next generation of experience creators.
          <br />
          <span className="text-white font-semibold">Ticketing. CRM. Finance.</span> All in one.
        </motion.p>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      >
        <span className="text-[10px] uppercase tracking-[0.4em] text-white/40">Scroll</span>
        <div className="w-px h-16 bg-gradient-to-b from-white/40 to-transparent" />
      </motion.div>
    </section>
  );
}

function FeatureShowcase() {
  return (
    <div className="space-y-32 py-32 px-6 max-w-[1400px] mx-auto">
      {features.map((feature, index) => (
        <FeatureSection key={feature.id} feature={feature} index={index} />
      ))}
    </div>
  );
}

function FeatureSection({ feature, index }) {
  const isEven = index % 2 === 0;

  return (
    <section className={`flex flex-col lg:flex-row gap-16 items-center ${isEven ? "" : "lg:flex-row-reverse"}`}>
      {/* Text Content */}
      <motion.div
        className="flex-1 space-y-8"
        initial={{ opacity: 0, x: isEven ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-20%" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="space-y-4">
          <div className={`flex items-center gap-3 text-${feature.color}-400`}>
            <span className="h-px w-8 bg-current opacity-50" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">{feature.subtitle}</span>
          </div>
          <h2 className="font-heading text-5xl sm:text-6xl font-bold leading-[0.95]">
            {feature.title}
          </h2>
          <p className="text-lg text-white/60 leading-relaxed max-w-md">
            {feature.description}
          </p>
        </div>
        <button className="group flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-white/80 transition-colors">
          Get Started
          <span className="block h-px w-8 bg-white transition-all group-hover:w-12" />
        </button>
      </motion.div>

      {/* Visual Content */}
      <motion.div
        className="flex-1 w-full"
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-20%" }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        <div className="relative aspect-[4/3] w-full rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          {feature.visual === "ComposerUI" && <ComposerUI />}
          {feature.visual === "GrowthUI" && <GrowthUI />}
          {feature.visual === "CapitalUI" && <CapitalUI />}
          {feature.visual === "AnalyticsUI" && <AnalyticsUI />}
        </div>
      </motion.div>
    </section>
  );
}

// --- UI Mockups ---

function ComposerUI() {
  return (
    <div className="absolute inset-0 p-8 flex flex-col justify-center">
      <div className="relative w-full max-w-md mx-auto bg-black border border-white/10 rounded-3xl p-6 shadow-2xl">
        {/* Header Image */}
        <div className="h-32 w-full bg-white/10 rounded-xl mb-6 relative overflow-hidden group">
          <Image src="/events/lofi-house.svg" alt="Event" fill className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] uppercase font-bold">Cover</div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="h-10 w-full border-b border-white/20 flex items-center text-sm text-white/50 font-mono">
            <span className="text-white">Union</span>
            <span className="animate-pulse">|</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 border border-dashed border-orange-500/30 rounded-lg flex items-center px-3 text-xs text-orange-500/70 bg-orange-500/5">
              Event Start
            </div>
            <div className="h-10 border border-dashed border-orange-500/30 rounded-lg flex items-center px-3 text-xs text-orange-500/70 bg-orange-500/5">
              Event End
            </div>
          </div>
          <div className="h-10 border border-dashed border-orange-500/30 rounded-lg flex items-center px-3 text-xs text-orange-500/70 bg-orange-500/5">
            <span className="mr-2">📍</span> Event Location
          </div>
        </div>

        {/* Floating Elements */}
        <motion.div
          className="absolute -right-12 top-12 bg-orange-500 text-black font-bold text-xs px-4 py-2 rounded-full shadow-lg"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          AI Generated ⚡️
        </motion.div>
      </div>
    </div>
  );
}

function GrowthUI() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image src="/events/rave.jpg" alt="Crowd" fill className="object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
        <motion.div
          className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 flex gap-4 items-start shadow-xl"
          initial={{ x: -50, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-black font-bold">
            📢
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <h4 className="font-bold text-sm">Early Bird SMS</h4>
              <span className="text-[10px] text-white/50">2m ago</span>
            </div>
            <p className="text-xs text-white/80">"Presale is LIVE! Use code C1RCLE for 20% off first 100 tix."</p>
          </div>
        </motion.div>

        <motion.div
          className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 flex gap-4 items-start shadow-xl translate-x-8"
          initial={{ x: 50, opacity: 0 }}
          whileInView={{ x: 20, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-400 to-stone-600 flex items-center justify-center text-white font-bold">
            🚀
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <h4 className="font-bold text-sm">Affiliate Boost</h4>
              <span className="text-[10px] text-white/50">Just now</span>
            </div>
            <p className="text-xs text-white/80">Your promoters just sold 45 tickets in the last hour.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function CapitalUI() {
  return (
    <div className="absolute inset-0 bg-[#050505] p-8 flex items-center justify-center">
      <div className="w-full h-full border border-white/10 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Total Revenue</div>
            <div className="text-4xl font-bold text-white">$29,400</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Attendees</div>
            <div className="text-2xl font-bold text-white">2,940</div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-40 w-full mt-8">
          {/* Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map(i => <div key={i} className="w-full h-px bg-white/5" />)}
          </div>

          {/* Line Path */}
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F44A22" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#F44A22" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,120 C50,100 100,130 150,60 C200,0 250,40 300,20 C350,0 400,30 450,10"
              fill="none"
              stroke="#F44A22"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              filter="drop-shadow(0 0 8px rgba(244,74,34,0.5))"
            />
            <motion.path
              d="M0,120 C50,100 100,130 150,60 C200,0 250,40 300,20 C350,0 400,30 450,10 L450,160 L0,160 Z"
              fill="url(#chartGradient)"
              stroke="none"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 2, delay: 0.5 }}
            />
            {/* Points */}
            {[
              { cx: 150, cy: 60 }, { cx: 300, cy: 20 }, { cx: 450, cy: 10 }
            ].map((p, i) => (
              <motion.circle
                key={i}
                cx={p.cx}
                cy={p.cy}
                r="4"
                fill="#050505"
                stroke="#F44A22"
                strokeWidth="2"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ delay: 1 + i * 0.2 }}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

function AnalyticsUI() {
  return (
    <div className="absolute inset-0 bg-[#080808] p-6 flex items-center justify-center">
      <div className="grid grid-cols-2 gap-4 w-full h-full">
        {/* List */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Attendee Location</div>
          {[
            { city: "Mumbai, IN", val: 107 },
            { city: "Pune, IN", val: 95 },
            { city: "Bangalore, IN", val: 83 },
            { city: "Delhi, IN", val: 82 },
            { city: "Goa, IN", val: 74 },
          ].map((item, i) => (
            <div key={item.city} className="flex justify-between items-center text-xs">
              <span className="text-white/80">{item.city}</span>
              <span className="font-mono text-white/40">{item.val}</span>
            </div>
          ))}
        </div>

        {/* Pie Chart */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-center relative">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#333" strokeWidth="20" />
              <motion.circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke="#F44A22"
                strokeWidth="20"
                strokeDasharray="251.2"
                strokeDashoffset="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                whileInView={{ strokeDashoffset: 100 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <motion.circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke="#A8AAAC"
                strokeWidth="20"
                strokeDasharray="251.2"
                strokeDashoffset="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                whileInView={{ strokeDashoffset: 180 }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                className="opacity-80"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xs font-bold">Male</span>
              <span className="text-[10px] text-white/50">42%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkSection() {
  return (
    <section className="py-32 px-6 bg-black relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center mb-20 relative z-10">
        <h2 className="font-heading text-5xl sm:text-7xl font-bold mb-6">
          The <span className="text-orange">Network</span> Effect
        </h2>
        <p className="text-xl text-white/60 max-w-2xl mx-auto">
          Turn every attendee into a promoter. Our Kickback system incentivizes your community to sell tickets for you.
        </p>
      </div>

      <div className="relative h-[600px] max-w-6xl mx-auto rounded-[48px] border border-white/10 bg-[#030303] overflow-hidden shadow-2xl">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,74,34,0.15),transparent_60%)]" />

        <NetworkGraph />
      </div>
    </section>
  );
}

function NetworkGraph() {
  // Positions tuned to look like a distributed network
  const nodes = [
    { id: 1, x: 25, y: 45 },
    { id: 2, x: 50, y: 35 },
    { id: 3, x: 75, y: 50 },
    { id: 4, x: 30, y: 70 },
    { id: 5, x: 55, y: 65 },
    { id: 6, x: 80, y: 75 },
    { id: 7, x: 40, y: 85 },
    { id: 8, x: 15, y: 75 },
  ];

  const connections = [
    [1, 2], [2, 3], [2, 5], [1, 4], [4, 5], [5, 6], [5, 7], [4, 8], [7, 8], [3, 6], [4, 7]
  ];

  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="netGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F44A22" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#FF6B4A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F44A22" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {connections.map(([startId, endId], i) => {
          const start = nodes.find(n => n.id === startId);
          const end = nodes.find(n => n.id === endId);
          return (
            <motion.line
              key={`${startId}-${endId}`}
              x1={`${start.x}%`}
              y1={`${start.y}%`}
              x2={`${end.x}%`}
              y2={`${end.y}%`}
              stroke="url(#netGradient)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: i * 0.05 }}
            />
          );
        })}
      </svg>

      {/* Traveling Particles */}
      {connections.map(([startId, endId], i) => {
        const start = nodes.find(n => n.id === startId);
        const end = nodes.find(n => n.id === endId);
        return <ConnectionParticle key={`p-${startId}-${endId}`} start={start} end={end} delay={i * 0.2} />;
      })}

      {nodes.map((node, i) => (
        <motion.div
          key={node.id}
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[#0a0a0a] border border-orange/60 shadow-[0_0_20px_rgba(244,74,34,0.6)] z-10"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
        >
          {/* Inner Glow Pulse */}
          <motion.div
            className="absolute inset-0 bg-orange rounded-full"
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function ConnectionParticle({ start, end, delay }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-orange shadow-[0_0_8px_rgba(244,74,34,1)] z-0"
      initial={{ left: `${start.x}%`, top: `${start.y}%`, opacity: 0 }}
      animate={{
        left: [`${start.x}%`, `${end.x}%`],
        top: [`${start.y}%`, `${end.y}%`],
        opacity: [0, 1, 0]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        delay: delay,
        ease: "linear"
      }}
    />
  );
}

function UseCasesSection() {
  const scrollRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);

  return (
    <section ref={scrollRef} className="py-32 bg-black overflow-hidden">
      <div className="px-6 mb-16 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-orange text-xl">⚡️</span>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Limitless Use Cases</span>
        </div>
        <h2 className="font-heading text-5xl sm:text-6xl font-bold leading-tight">
          Built for every kind of<br />IRL experience.
        </h2>
      </div>

      <div className="flex gap-6 px-6 overflow-x-auto pb-8 no-scrollbar snap-x">
        {useCases.map((useCase, i) => (
          <motion.div
            key={useCase.title}
            className="relative flex-none w-[300px] sm:w-[400px] aspect-[3/4] rounded-3xl overflow-hidden group snap-center"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Image
              src={useCase.image}
              alt={useCase.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
            <div className="absolute bottom-0 left-0 p-8">
              <div className="flex items-center gap-2 text-orange-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">{useCase.title}</span>
              </div>
              <p className="text-xl text-white/80">{useCase.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="py-32 px-6 max-w-3xl mx-auto">
      <div className="text-center mb-16">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-4 block">FAQ</span>
        <h2 className="font-heading text-4xl font-bold">Navigating a new ecosystem...</h2>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <FAQItem key={i} faq={faq} />
        ))}
      </div>
    </section>
  );
}

function FAQItem({ faq }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      className="border border-white/10 rounded-2xl bg-white/5 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-bold text-lg">{faq.question}</span>
        <span className={`text-2xl transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}>+</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-0 text-white/60 leading-relaxed">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CTASection() {
  return (
    <section className="py-32 px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-orange/10 pointer-events-none" />
      <div className="max-w-4xl mx-auto space-y-10 relative z-10">
        <h2 className="font-heading text-5xl sm:text-8xl font-black tracking-tighter">
          Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange via-white to-orange">Ascend?</span>
        </h2>
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <a
            href="/create"
            className="btn-lift px-10 py-5 bg-white text-black rounded-full font-bold uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.3)]"
          >
            Start Creating
          </a>
        </div>
      </div>
    </section>
  );
}
