import Image from "next/image";
import Button from "./ui/Button";

export default function TicketCard({ event }) {
  return (
    <div className="glass-panel rounded-[32px] p-6 lg:flex lg:gap-8">
      <div className="relative h-64 flex-1 overflow-hidden rounded-[24px]">
        <Image src={event.image} alt={event.title} fill className="object-cover" />
      </div>
      <div className="mt-6 flex flex-1 flex-col gap-4 lg:mt-0">
        <h1 className="text-3xl font-display">{event.title}</h1>
        <p className="text-white/60">{event.date} · {event.time}</p>
        <p className="text-white/60">{event.location}</p>
        <Button>View Ticket</Button>
        <div className="rounded-2xl border border-dashed border-white/20 p-4 text-center">
          <p className="text-sm text-white/60">Scan to save to wallet</p>
          <div className="mx-auto mt-4 h-28 w-28 rounded-2xl bg-white/10" />
        </div>
      </div>
    </div>
  );
}
