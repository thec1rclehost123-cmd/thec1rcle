import CreateEventForm from "../../components/CreateEventForm";
import Footer from "../../components/Footer";

export default function CreatePage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-black">
      <main className="px-4 pb-10 sm:px-6">
        {/* Subtle grid background */}
        <div className="create-grid absolute inset-0 -z-10 opacity-20" aria-hidden="true" />

        {/* Gradient glow */}
        <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-[520px] w-full bg-gradient-to-b from-iris/10 via-transparent to-transparent blur-[100px] dark:opacity-100 opacity-50" />

        {/* Header */}
        <div className="relative mx-auto mb-12 max-w-4xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-iris">Studio</p>
          <h1 className="mt-4 text-5xl font-heading font-bold uppercase tracking-tight text-black dark:text-white sm:text-6xl md:text-7xl">
            Create Event
          </h1>
          <p className="mt-4 text-lg text-black/60 dark:text-white/60 max-w-2xl mx-auto">
            Build your event in minutes. Every detail you add shows up beautifully on your event page.
          </p>
        </div>

        {/* Form */}
        <div className="mx-auto max-w-5xl">
          <CreateEventForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
