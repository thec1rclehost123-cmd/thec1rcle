import CreateEventForm from "../../components/CreateEventForm";

export default function CreatePage() {
  return (
    <section className="relative isolate overflow-hidden px-4 pb-24 pt-12 sm:px-6">
      <div className="create-grid absolute inset-0 -z-10 opacity-30" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] w-[90%] rounded-full bg-gradient-to-b from-white/20 via-transparent to-transparent blur-[200px]" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="text-xs uppercase tracking-[0.6em] text-white/40">Studio Build Mode</p>
        <h1 className="mt-4 text-4xl font-display uppercase tracking-[0.2em] sm:text-5xl">Create an Event</h1>
        <p className="mt-3 max-w-3xl text-white/60">
          Craft a dark, premium drop page. Every field below feeds the flyer, tickets, and RSVP data your guests see inside the
          app.
        </p>
      </div>
      <div className="mx-auto mt-12 max-w-6xl">
        <CreateEventForm />
      </div>
    </section>
  );
}
