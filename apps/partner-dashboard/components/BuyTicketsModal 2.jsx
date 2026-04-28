"use client";

export default function BuyTicketsModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-panel card-hover mx-auto mt-40 w-full max-w-xs rounded-3xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex justify-center space-x-2">
          {[1,2,3,4,5].map((item) => (
            <div key={item} className="h-10 w-10 overflow-hidden rounded-full bg-white/10" />
          ))}
        </div>
        <p className="mb-4 text-sm text-white/70">Buy tickets to see who's going</p>
        <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Get Tickets</button>
      </div>
    </div>
  );
}
