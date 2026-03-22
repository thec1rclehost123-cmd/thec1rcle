"use client";

import nextDynamic from "next/dynamic";

const HeroCarousel = nextDynamic(() => import("./HeroCarousel"), { ssr: false });

export default function HeroCarouselClient(props) {
  return <HeroCarousel {...props} />;
}
