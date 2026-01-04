"use client";

export default function Toggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/80"
    >
      <span className="uppercase tracking-[0.3em] text-[11px]">{label}</span>
      <span
        className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
          value ? "bg-white" : "bg-white/20"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-black transition ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
