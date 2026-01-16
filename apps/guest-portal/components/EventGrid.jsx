import EventCard from "./EventCard";

export default function EventGrid({ events = [] }) {
  if (!events.length) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-[32px] border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5">
        <p className="text-sm font-medium uppercase tracking-widest text-black/40 dark:text-white/50">
          No events found
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-2 pb-12 sm:px-6 sm:pt-4 sm:pb-24 lg:px-8">
      <div className="grid grid-cols-1 gap-6 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
        {events.map((event, index) => (
          <EventCard key={event.id || index} event={event} index={index} />
        ))}
      </div>
    </section>
  );
}
