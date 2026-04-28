"use client";

import { MiniAvatar, SectionLabel } from "../EventDetailPrimitives";

export function EventCrowdModal({ crowdPeople, dominantColor, interestedCount, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-12">
      <button
        type="button"
        aria-label="Close going list"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <div
        className="relative z-10 max-h-[90vh] w-full max-w-[920px] overflow-y-auto overflow-hidden rounded-[30px] border border-white/10 bg-[#0c0c10]/95 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.48)] backdrop-blur-3xl sm:p-7"
        style={{ boxShadow: `0 0 100px rgba(${dominantColor}, 0.1)` }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionLabel>Going</SectionLabel>
              <div className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-white sm:text-[34px]">Guest list</div>
              {interestedCount > 0 ? (
                <div className="mt-2 text-[13px] text-white/50">{interestedCount.toLocaleString("en-IN")} people going</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-6 flex max-h-[68vh] flex-wrap gap-3 overflow-y-auto pr-1">
            {crowdPeople.map((person) => (
              <div
                key={`crowd-modal-${person.id || person.name}`}
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/15 shadow-lg sm:h-24 sm:w-24"
              >
                <MiniAvatar person={person} size="xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
