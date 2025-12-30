"use client";

import { motion } from "framer-motion";

export default function PrivacyPage() {
  const sections = [
    {
      title: "Our Manifesto on Privacy",
      content: "At The C1rcle, we believe your data is your digital soul. We don't trade it, we don't leak it, and we definitely don't use it to turn you into a product. Our mission is to facilitate life offline—your online presence with us is purely a utility to make that happen."
    },
    {
      title: "Data We Collect",
      content: "We collect only what's necessary to get you into the event: your name, email, and phone number for ticketing and communication. If you're a host, we collect payout information to ensure you get paid on time. We also use anonymized analytics to understand how our community uses the platform, making it better for everyone."
    },
    {
      title: "The 'No-Creep' Policy",
      content: "We do not track your location across other apps. We do not sell your contact list. We do not listen to your microphone. Period."
    },
    {
      title: "Your Control",
      content: "You can purge your account and all associated data at any time from the profile settings. No questions asked. No hidden 'cool-down' periods."
    },
    {
      title: "Updates",
      content: "If we update this manifesto, we'll let you know via email. Not a 50-page legal doc, but a clear explanation of what changed and why."
    }
  ];

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white pb-32 pt-40 px-6 sm:px-12">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-iris/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange/10 border border-orange/20 text-orange font-bold text-[10px] uppercase tracking-widest mb-6">
            Safe & Secure
          </div>
          <h1 className="font-heading text-5xl sm:text-7xl font-black uppercase tracking-tighter leading-none mb-8">
            Privacy<br />Manifesto
          </h1>
          <p className="text-xl text-black/60 dark:text-white/40 max-w-2xl font-light">
            Last updated: January 2025. Your privacy is not a feature; it is the foundation of our community.
          </p>
        </motion.div>

        <div className="grid gap-16">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group"
            >
              <h2 className="font-heading text-2xl font-bold uppercase tracking-tight mb-4 flex items-center gap-4 group-hover:text-orange transition-colors">
                <span className="text-xs font-mono text-black/20 dark:text-white/20">0{i + 1}</span>
                {section.title}
              </h2>
              <div className="h-px w-full bg-black/5 dark:bg-white/5 mb-6" />
              <p className="text-lg text-black/60 dark:text-white/50 leading-relaxed font-light">
                {section.content}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-32 p-12 rounded-[40px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-center"
        >
          <h3 className="font-heading text-2xl font-bold mb-4 uppercase tracking-tight">Questions?</h3>
          <p className="text-black/40 dark:text-white/40 mb-8 max-w-md mx-auto">
            If you have any doubts about how your data is handled, we're here to talk.
          </p>
          <a
            href="mailto:privacy@thec1rcle.host"
            className="inline-flex h-12 items-center px-8 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Contact Privacy Team
          </a>
        </motion.div>
      </div>
    </div>
  );
}
