"use client";

import { motion } from "framer-motion";
import Cropper from "react-easy-crop";

export function AvatarCropDialog({
  crop,
  imageSrc,
  onCancel,
  onCropChange,
  onCropComplete,
  onSave,
  onZoomChange,
  zoom,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-black rounded-3xl border border-black/[0.08] dark:border-white/20 overflow-hidden">
        <div className="p-6 border-b border-black/[0.06] dark:border-white/10">
          <h3 className="text-xl font-bold text-black dark:text-white uppercase tracking-widest">Crop Profile Picture</h3>
        </div>
        <div className="relative h-[300px] sm:h-[400px] md:h-[500px] bg-[#FAFAF9] dark:bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="p-6 space-y-4 bg-gradient-to-b from-white dark:from-black to-white/95 dark:to-black/95">
          <div className="space-y-2">
            <label className="text-xs text-black/60 dark:text-white/60 uppercase tracking-widest">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => onZoomChange(Number(event.target.value))}
              className="w-full accent-black dark:accent-white"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 rounded-2xl border border-black/10 dark:border-white/10 font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex-1 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
