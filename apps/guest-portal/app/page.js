import HeroVideo from "../components/HeroVideo";
import HeroCarousel from "../components/HeroCarousel";
import CategoryBar from "../components/CategoryBar";
import EventGrid from "../components/EventGrid";
import Selects from "../components/Selects";
import InterviewSection from "../components/InterviewSection";
import SectionReveal from "../components/SectionReveal";
import { heroVideoSrc, getHomepageContent } from "../lib/homepageData";

export default async function HomePage() {
  const { heroCards, categoryFilters, eventGrid, selects, interviews } = await getHomepageContent();
  return (
    <>
      <HeroVideo src={heroVideoSrc} />
      <SectionReveal>
        <HeroCarousel cards={heroCards} />
      </SectionReveal>
      <SectionReveal>
        <CategoryBar categories={categoryFilters} />
      </SectionReveal>
      <EventGrid events={eventGrid} />
      <Selects items={selects} />
      <InterviewSection interviews={interviews} />
    </>
  );
}
