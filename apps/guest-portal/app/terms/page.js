"use client";

import { motion } from "framer-motion";

export default function TermsPage() {
  const sections = [
    {
      title: "The Vibe Agreement",
      content: "By using The C1rcle, you agree to contribute to a positive, safe, and exciting ecosystem. This is a community platform for discovering real-life experiences. Hostile, discriminatory, or harassing behavior will result in an immediate and permanent shadow-ban."
    },
    {
      title: "Ticketing & Refuns",
      content: "The C1rcle is a platform that facilitates transactions between hosts and attendees. Refund policies are set by individual event hosts. Unless an event is cancelled, all ticket sales are final. If an event is cancelled, we will work with the host to ensure your funds are returned safely."
    },
    {
      title: "Host Responsibilities",
      content: "Hosts are responsible for the safety and execution of their events. The C1rcle provides the tools, but the host provides the experience. All hosts must adhere to local laws and regulations regarding venue safety and alcohol service."
    },
    {
      title: "Intellectual Property",
      content: "The designs, code, and brand 'The C1rcle' are our property. The content you upload (event descriptions, images) remains yours, but you grant us a license to display it on our platform for your event's promotion."
    },
    {
      title: "Account Security",
      content: "You are responsible for keeping your login credentials safe. If you suspect your account has been compromised, notify us immediately. We will never ask for your password via email or social media."
    }
  ];

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white pb-32 pt-40 px-6 sm:px-12">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-iris/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-iris/10 border border-iris/20 text-iris-light font-bold text-[10px] uppercase tracking-widest mb-6">
            Community Guidelines
          </div>
          <h1 className="font-heading text-5xl sm:text-7xl font-black uppercase tracking-tighter leading-none mb-8">
            Terms &<br />Conditions
          </h1>
          <p className="text-xl text-black/60 dark:text-white/40 max-w-2xl font-light">
            Last updated: January 2025. These are the rules of the road for discovering life offline.
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
              <h2 className="font-heading text-2xl font-bold uppercase tracking-tight mb-4 flex items-center gap-4 group-hover:text-iris-light transition-colors">
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
          <h3 className="font-heading text-2xl font-bold mb-4 uppercase tracking-tight">Need Help?</h3>
          <p className="text-black/40 dark:text-white/40 mb-8 max-w-md mx-auto">
            Our support team is always available to clarify any part of the vibe agreement.
          </p>
          <a
            href="mailto:support@thec1rcle.host"
            className="inline-flex h-12 items-center px-8 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Contact Support
          </a>
        </motion.div>
      </div>
    </div>
  );
}
