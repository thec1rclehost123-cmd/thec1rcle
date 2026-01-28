"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";

export default function VenueReelsSection({ videos = [], venueName = "Venue" }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const videoRefs = useRef([]);

    useEffect(() => {
        videoRefs.current.forEach((video, idx) => {
            if (video) {
                if (idx === currentIndex && isPlaying) {
                    video.play().catch(() => { });
                } else {
                    video.pause();
                }
                video.muted = isMuted;
            }
        });
    }, [currentIndex, isPlaying, isMuted]);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % videos.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    };

    if (!videos || videos.length === 0) return null;

    return (
        <section className="py-32 bg-black relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#F44A22]/10 rounded-full blur-[200px]" />

            <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 relative z-10">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#F44A22] mb-4 block">Behind The Scenes</span>
                        <h2 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter leading-none text-white">
                            The<br />
                            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]">Vibe Check.</span>
                        </h2>
                    </div>
                    <p className="text-sm text-white/40 max-w-sm font-medium">
                        Experience the energy through short clips captured in our space
                    </p>
                </div>

                {/* Reels Carousel */}
                <div className="relative">
                    {/* Main Reel Container */}
                    <div className="flex gap-6 items-center justify-center">
                        {/* Navigation - Left */}
                        {videos.length > 1 && (
                            <button
                                onClick={handlePrev}
                                className="hidden md:flex w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 items-center justify-center hover:bg-white/20 transition-all"
                            >
                                <ChevronLeft className="h-6 w-6 text-white" />
                            </button>
                        )}

                        {/* Reel Display */}
                        <div className="relative w-full max-w-[400px] aspect-[9/16] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl group">
                            {videos.map((video, idx) => (
                                <video
                                    key={idx}
                                    ref={(el) => (videoRefs.current[idx] = el)}
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${idx === currentIndex ? "opacity-100" : "opacity-0"
                                        }`}
                                    src={video}
                                    loop
                                    playsInline
                                    muted={isMuted}
                                />
                            ))}

                            {/* Gradient Overlays */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                            {/* Live Badge */}
                            <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Reel {currentIndex + 1}/{videos.length}</span>
                            </div>

                            {/* Controls */}
                            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-white/30 transition-all"
                                >
                                    {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white" />}
                                </button>

                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-white/30 transition-all"
                                >
                                    {isMuted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
                                </button>
                            </div>

                            {/* Progress Dots */}
                            {videos.length > 1 && (
                                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
                                    {videos.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? "w-8 bg-[#F44A22]" : "w-4 bg-white/30"
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Navigation - Right */}
                        {videos.length > 1 && (
                            <button
                                onClick={handleNext}
                                className="hidden md:flex w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 items-center justify-center hover:bg-white/20 transition-all"
                            >
                                <ChevronRight className="h-6 w-6 text-white" />
                            </button>
                        )}
                    </div>

                    {/* Mobile Navigation */}
                    {videos.length > 1 && (
                        <div className="flex md:hidden justify-center gap-4 mt-8">
                            <button onClick={handlePrev} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                <ChevronLeft className="h-5 w-5 text-white" />
                            </button>
                            <button onClick={handleNext} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                <ChevronRight className="h-5 w-5 text-white" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
