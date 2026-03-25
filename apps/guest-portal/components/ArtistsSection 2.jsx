"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const artistPool = [
  {
    name: "Sienna Cole",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Milo Hart",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Theo Knox",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Nia Arden",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Jace Monroe",
    image: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=900&h=900&q=80",
    monochrome: true,
  },
  {
    name: "Nova Saint",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Lena Vale",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Ari Vega",
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Kai Rivers",
    image: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Ivy Sol",
    image: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Orion Vale",
    image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Romy Lux",
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Ezra Hale",
    image: "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&w=900&h=900&q=80",
  },
  {
    name: "Lia Voss",
    image: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=900&h=900&q=80",
  },
];

const sizeClasses = {
  xs: "h-[42px] w-[42px] sm:h-[68px] sm:w-[68px] lg:h-[84px] lg:w-[84px]",
  sm: "h-[52px] w-[52px] sm:h-[82px] sm:w-[82px] lg:h-[100px] lg:w-[100px]",
  md: "h-[64px] w-[64px] sm:h-[102px] sm:w-[102px] lg:h-[122px] lg:w-[122px]",
  lg: "h-[82px] w-[82px] sm:h-[132px] sm:w-[132px] lg:h-[156px] lg:w-[156px]",
  xl: "h-[104px] w-[104px] sm:h-[162px] sm:w-[162px] lg:h-[196px] lg:w-[196px]",
  hero: "h-[120px] w-[120px] sm:h-[186px] sm:w-[186px] lg:h-[232px] lg:w-[232px]",
};

const bubbleLayouts = [
  { x: 16, y: 23, size: "xs", rotate: "-rotate-[9deg]", depth: "back" },
  { x: 27, y: 19, size: "sm", rotate: "rotate-[7deg]", depth: "back" },
  { x: 38, y: 16, size: "xs", rotate: "-rotate-[6deg]", depth: "back" },
  { x: 50, y: 14, size: "sm", rotate: "rotate-[4deg]", depth: "back" },
  { x: 62, y: 16, size: "xs", rotate: "-rotate-[7deg]", depth: "back" },
  { x: 73, y: 19, size: "sm", rotate: "rotate-[8deg]", depth: "back" },
  { x: 84, y: 23, size: "xs", rotate: "-rotate-[8deg]", depth: "back" },
  { x: 12, y: 39, size: "sm", rotate: "-rotate-[8deg]", depth: "back" },
  { x: 22, y: 34, size: "md", rotate: "rotate-[7deg]", depth: "mid" },
  { x: 33, y: 31, size: "sm", rotate: "-rotate-[6deg]", depth: "back" },
  { x: 44, y: 29, size: "lg", rotate: "rotate-[5deg]", depth: "mid" },
  { x: 56, y: 30, size: "md", rotate: "-rotate-[5deg]", depth: "mid" },
  { x: 68, y: 32, size: "lg", rotate: "rotate-[7deg]", depth: "mid" },
  { x: 80, y: 35, size: "sm", rotate: "-rotate-[7deg]", depth: "back" },
  { x: 89, y: 40, size: "md", rotate: "rotate-[6deg]", depth: "mid" },
  { x: 10, y: 58, size: "sm", rotate: "-rotate-[9deg]", depth: "mid" },
  { x: 20, y: 54, size: "md", rotate: "rotate-[8deg]", depth: "front" },
  { x: 31, y: 51, size: "lg", rotate: "-rotate-[8deg]", depth: "front" },
  { x: 42, y: 49, size: "md", rotate: "rotate-[6deg]", depth: "mid" },
  { x: 54, y: 46, size: "xl", rotate: "-rotate-[4deg]", depth: "hero", featured: true },
  { x: 67, y: 50, size: "lg", rotate: "rotate-[8deg]", depth: "front" },
  { x: 78, y: 53, size: "md", rotate: "-rotate-[7deg]", depth: "front" },
  { x: 88, y: 58, size: "sm", rotate: "rotate-[8deg]", depth: "mid" },
  { x: 19, y: 69, size: "xs", rotate: "-rotate-[7deg]", depth: "back" },
  { x: 29, y: 66, size: "md", rotate: "rotate-[9deg]", depth: "front" },
  { x: 40, y: 64, size: "sm", rotate: "-rotate-[10deg]", depth: "mid" },
  { x: 51, y: 62, size: "hero", rotate: "rotate-[5deg]", depth: "hero", featured: true },
  { x: 63, y: 65, size: "md", rotate: "-rotate-[6deg]", depth: "front" },
  { x: 74, y: 67, size: "sm", rotate: "rotate-[8deg]", depth: "mid" },
  { x: 84, y: 70, size: "xs", rotate: "-rotate-[8deg]", depth: "back" },
  { x: 36, y: 76, size: "xs", rotate: "-rotate-[9deg]", depth: "back" },
  { x: 47, y: 75, size: "sm", rotate: "rotate-[7deg]", depth: "mid" },
  { x: 58, y: 76, size: "xs", rotate: "-rotate-[6deg]", depth: "back" },
  { x: 70, y: 75, size: "sm", rotate: "rotate-[9deg]", depth: "mid" },
];

const depthClasses = {
  back: "z-10 opacity-75",
  mid: "z-20 opacity-90",
  front: "z-30",
  hero: "z-40",
};

function ArtistBubble({ artist, layout, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.82, y: 16 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{
        duration: 0.46,
        delay: Math.min(index * 0.018, 0.42),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: layout.featured ? 1.08 : 1.13, y: layout.featured ? -8 : -10 }}
      className={`group absolute -translate-x-1/2 -translate-y-1/2 ${sizeClasses[layout.size]} ${layout.rotate} ${depthClasses[layout.depth] ?? depthClasses.mid} ${
        layout.featured ? "hover:z-50" : "hover:z-40"
      }`}
      style={{ left: `${layout.x}%`, top: `${layout.y}%` }}
    >
      <div className="absolute inset-[-10%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.3),transparent_60%)] opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
      <div
        className={`relative h-full w-full overflow-hidden rounded-full border border-white/22 bg-white/[0.07] shadow-[0_28px_55px_rgba(0,0,0,0.32)] backdrop-blur-2xl transition-all duration-500 group-hover:border-white/60 group-hover:shadow-[0_36px_78px_rgba(255,255,255,0.10)] ${
          layout.featured ? "ring-1 ring-white/20 shadow-[0_34px_80px_rgba(0,0,0,0.42)]" : ""
        }`}
      >
        <Image
          src={artist.image}
          alt={artist.name}
          fill
          sizes="(max-width: 640px) 120px, (max-width: 1024px) 186px, 232px"
          className={`object-cover transition-transform duration-700 ease-out group-hover:scale-110 ${
            artist.monochrome ? "grayscale contrast-[1.06]" : "saturate-[1.02]"
          }`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.06)_28%,rgba(10,10,12,0.22)_100%)]" />
        <div className="absolute inset-[2px] rounded-full border border-white/16" />
        <div className="absolute left-[18%] top-[10%] h-[20%] w-[42%] rounded-full bg-white/42 blur-md opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.26),transparent_38%),radial-gradient(circle_at_50%_82%,rgba(244,74,34,0.14),transparent_45%)] opacity-85 transition-opacity duration-500 group-hover:opacity-100" />
      </div>
    </motion.div>
  );
}

export default function ArtistsSection() {
  return (
    <section className="relative isolate overflow-hidden bg-black py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
        <div className="absolute left-1/2 top-0 h-[32rem] w-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.11),transparent_72%)] blur-3xl" />
        <div className="absolute left-[10%] top-[18%] h-[16rem] w-[16rem] rounded-full bg-[radial-gradient(circle,rgba(244,74,34,0.18),transparent_72%)] blur-3xl" />
        <div className="absolute right-[10%] top-[12%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(110,140,255,0.16),transparent_70%)] blur-3xl" />
        <div className="absolute left-1/2 bottom-[4%] h-[14rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,74,34,0.12),transparent_72%)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-[0.34em] text-white/60 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff7d55]" />
            In Rotation
          </span>
          <h2 className="mt-7 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-[5.25rem] lg:leading-[0.95]">
            Artists shaping the week.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-7 text-white/48 sm:text-base">
            A tighter orbit of the faces moving the c1rcle right now.
          </p>
        </motion.div>

        <div className="relative mx-auto mt-10 h-[24rem] max-w-[1160px] sm:mt-14 sm:h-[34rem] lg:h-[46rem]">
          <div className="pointer-events-none absolute inset-x-[18%] top-[8%] h-[18%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.2),transparent_68%)] blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-[14%] h-[46%] w-[68%] -translate-x-1/2 rounded-[50%] border border-white/[0.06]" />
          <div className="pointer-events-none absolute left-1/2 top-[18%] h-[38%] w-[54%] -translate-x-1/2 rounded-[50%] border border-white/[0.05]" />
          <div className="pointer-events-none absolute left-1/2 bottom-[17%] h-[16%] w-[74%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.05)_42%,rgba(0,0,0,0)_76%)] blur-2xl" />
          <div className="pointer-events-none absolute left-1/2 bottom-[14%] h-px w-[70%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="pointer-events-none absolute left-1/2 bottom-[7%] h-[26%] w-[92%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(244,74,34,0.14)_0%,rgba(255,255,255,0.05)_42%,transparent_74%)] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-[10%] bottom-[8%] h-[54%] rounded-[45%] bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.06),transparent_58%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.04),transparent_58%)]" />

          {bubbleLayouts.map((layout, index) => {
            const artist = artistPool[index % artistPool.length];
            return <ArtistBubble key={`${artist.name}-${index}`} artist={artist} layout={layout} index={index} />;
          })}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-black via-black/82 to-transparent" />
        </div>

        <ul className="sr-only">
          {artistPool.map((artist) => (
            <li key={artist.name}>{artist.name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
