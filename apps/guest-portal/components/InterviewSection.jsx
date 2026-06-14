import InterviewCard from "./InterviewCard";

export default function InterviewSection({ interviews }) {
  return (
    <section className="mx-auto mb-16 max-w-[1400px] px-4 sm:mb-32 sm:px-6">
      <div className="mb-16 text-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-iris-glow">
          Voices of the Culture
        </p>
        <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-black dark:text-white sm:text-6xl">
          In Conversation
        </h2>
      </div>

      <div className="space-y-24">
        {interviews.map((item, index) => (
          <InterviewCard key={item.slug} item={item} index={index} />
        ))}
      </div>
    </section>
  );
}
