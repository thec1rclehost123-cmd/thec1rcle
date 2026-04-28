"use client";

import { useState } from "react";
import Image from "next/image";

export default function EventGallery({ images = [] }) {
  const [openImage, setOpenImage] = useState(null);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img, idx) => (
          <button
            key={idx}
            className="group relative aspect-video overflow-hidden rounded-3xl border border-white/10"
            onClick={() => setOpenImage(img)}
          >
            <Image src={img} alt={`Gallery ${idx}`} fill className="object-cover transition duration-500 group-hover:scale-105" />
          </button>
        ))}
      </div>
      {openImage && (
        <div className="modal-backdrop" onClick={() => setOpenImage(null)}>
          <div className="mx-auto mt-10 max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] border border-white/20">
              <Image src={openImage} alt="Gallery fullscreen" fill className="object-cover" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
