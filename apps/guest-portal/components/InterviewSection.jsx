import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

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
          <article key={item.slug} className={`flex flex-col gap-8 lg:items-center lg:gap-16 ${index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
            }`}>
            <div className="relative aspect-[4/3] flex-1 overflow-hidden rounded-[32px] border border-black/10 dark:border-white/10 bg-black/5 dark:bg-surface lg:aspect-[16/10]">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-iris" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/60">
                  Exclusive Interview
                </span>
              </div>

              <h3 className="font-heading text-3xl font-bold uppercase leading-[0.9] text-black dark:text-white sm:text-5xl">
                {item.title}
              </h3>

              <p className="text-base md:text-lg leading-relaxed text-black/60 dark:text-white/60">
                {item.excerpt}
              </p>

              <div className="pt-4">
                <Link
                  href={`/interviews/${item.slug}`}
                  className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black dark:text-white transition hover:text-iris-glow"
                >
                  Read Full Story
                  <svg
                    className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
