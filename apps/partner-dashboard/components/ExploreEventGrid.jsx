import EventCard from "./EventCard";


export default function ExploreEventGrid({ events = [] }) {
  if (!events.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {events.map((event, index) => (
        <EventCard key={event.id || index} event={event} index={index} height="h-[280px] sm:h-[500px]" />
      ))}
    </div>
  );
}
