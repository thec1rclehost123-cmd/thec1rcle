import HeroVideo from "../components/HeroVideo";
import HeroCarousel from "../components/HeroCarousel";
import CategoryBar from "../components/CategoryBar";
import EventGrid from "../components/EventGrid";
import Selects from "../components/Selects";
import InterviewSection from "../components/InterviewSection";
import Footer from "../components/Footer";
import SectionReveal from "../components/SectionReveal";
import { heroVideoSrc, getHomepageContent } from "../lib/homepageData";

export default async function HomePage() {
  const { heroCards, categoryFilters, eventGrid, selects, interviews } = await getHomepageContent();
  return (
    <>
      <SectionReveal>
        <HeroVideo src={heroVideoSrc} />
      </SectionReveal>
      <SectionReveal>
        <HeroCarousel cards={heroCards} />
      </SectionReveal>
      <SectionReveal>
        <CategoryBar categories={categoryFilters} />
      </SectionReveal>
      <SectionReveal>
        <EventGrid events={eventGrid} />
      </SectionReveal>
      <SectionReveal>
        <Selects items={selects} />
      </SectionReveal>
      <SectionReveal>
        <InterviewSection interviews={interviews} />
      </SectionReveal>
      <Footer />
    </>
  );
}
