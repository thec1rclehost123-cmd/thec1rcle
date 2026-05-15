"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Heart, Play, Pause, Volume2, VolumeX } from "lucide-react";

/**
 * VenueHighlights - Instagram-style story highlights
 * Horizontal scrollable highlights with story viewer supporting images & videos
 */
export default function VenueHighlights({ highlights = [], venueName = "Venue" }) {
    const [activeHighlight, setActiveHighlight] = useState(null);
    const [activeStoryIndex, setActiveStoryIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [liked, setLiked] = useState({});
    const videoRef = useRef(null);
    const progressRef = useRef(null);
    const timerRef = useRef(null);

    // Filter out empty highlights
    const validHighlights = highlights.filter(h => h && (h.stories?.length > 0 || h.coverImage || h.imageUrl));

    if (!validHighlights || validHighlights.length === 0) return null;

    const openStoryViewer = (highlight, index) => {
        setActiveHighlight(highlight);
        setActiveStoryIndex(0);
        document.body.style.overflow = 'hidden';
    };

    const closeStoryViewer = () => {
        setActiveHighlight(null);
        setActiveStoryIndex(0);
        document.body.style.overflow = 'auto';
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    const goToNextStory = () => {
        if (!activeHighlight) return;
        const stories = activeHighlight.stories || [{ type: 'image', url: activeHighlight.coverImage || activeHighlight.imageUrl }];

        if (activeStoryIndex < stories.length - 1) {
            setActiveStoryIndex(prev => prev + 1);
        } else {
            // Go to next highlight or close
            const currentHighlightIndex = validHighlights.findIndex(h => h.id === activeHighlight.id);
            if (currentHighlightIndex < validHighlights.length - 1) {
                setActiveHighlight(validHighlights[currentHighlightIndex + 1]);
                setActiveStoryIndex(0);
            } else {
                closeStoryViewer();
            }
        }
    };

    const goToPrevStory = () => {
        if (activeStoryIndex > 0) {
            setActiveStoryIndex(prev => prev - 1);
        } else {
            // Go to previous highlight
            const currentHighlightIndex = validHighlights.findIndex(h => h.id === activeHighlight.id);
            if (currentHighlightIndex > 0) {
                const prevHighlight = validHighlights[currentHighlightIndex - 1];
                setActiveHighlight(prevHighlight);
                const prevStories = prevHighlight.stories || [{ type: 'image', url: prevHighlight.coverImage || prevHighlight.imageUrl }];
                setActiveStoryIndex(prevStories.length - 1);
            }
        }
    };

    const toggleLike = (highlightId, storyIndex) => {
        const key = `${highlightId}-${storyIndex}`;
        setLiked(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleTapNavigation = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        if (x < width / 3) {
            goToPrevStory();
        } else if (x > (width * 2) / 3) {
            goToNextStory();
        } else {
            setIsPaused(!isPaused);
        }
    };

    // Auto-advance timer for images
    useEffect(() => {
        if (!activeHighlight || isPaused) return;

        const stories = activeHighlight.stories || [{ type: 'image', url: activeHighlight.coverImage || activeHighlight.imageUrl }];
        const currentStory = stories[activeStoryIndex];

        if (currentStory?.type !== 'video') {
            timerRef.current = setTimeout(() => {
                goToNextStory();
            }, 5000);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [activeHighlight, activeStoryIndex, isPaused]);

    return (
        <>
            {/* Highlights Row */}
            <section className="py-4">
                <div className="flex gap-5 overflow-x-auto no-scrollbar px-4 sm:px-6 md:px-12 lg:px-24">
                    {validHighlights.map((highlight, idx) => (
                        <button
                            key={highlight.id || idx}
                            onClick={() => openStoryViewer(highlight, idx)}
                            className="flex flex-col items-center gap-3 flex-shrink-0 group"
                        >
                            {/* Ring Container */}
                            <div className="relative p-[3px] rounded-full bg-gradient-to-br from-[#F44A22] via-[#FF6B4A] to-[#F44A22] group-hover:scale-105 transition-transform duration-300">
                                <div className="w-[72px] h-[72px] rounded-full border-[3px] border-white dark:border-[#0A0A0A] overflow-hidden bg-black/5 dark:bg-white/5">
                                    {(highlight.coverImage || highlight.imageUrl) ? (
                                        <Image
                                            src={highlight.coverImage || highlight.imageUrl}
                                            width={72}
                                            height={72}
                                            alt={highlight.title || 'Highlight'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F44A22]/20 to-[#FF6B4A]/20">
                                            <Play className="h-6 w-6 text-[#F44A22]" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Title */}
                            <span className="text-[10px] font-bold text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white transition-colors max-w-[80px] truncate">
                                {highlight.title ?? 'Highlight'}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Story Viewer Modal */}
            {activeHighlight && (
                <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
                    {/* Close Button */}
                    <button
                        onClick={closeStoryViewer}
                        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <X className="h-5 w-5 text-white" />
                    </button>

                    {/* Story Container */}
                    <div
                        onClick={handleTapNavigation}
                        className="relative w-full h-full max-w-md mx-auto cursor-pointer"
                    >
                        {/* Progress Bars */}
                        <div className="absolute top-4 left-4 right-14 z-40 flex gap-1.5">
                            {(activeHighlight.stories || [{ type: 'image', url: activeHighlight.coverImage || activeHighlight.imageUrl }]).map((_, idx) => (
                                <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full bg-white transition-all duration-100 ${idx < activeStoryIndex ? 'w-full' :
                                            idx === activeStoryIndex ? 'animate-progress' : 'w-0'
                                            }`}
                                        style={idx === activeStoryIndex ? { animationDuration: '5s', animationPlayState: isPaused ? 'paused' : 'running' } : {}}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Header */}
                        <div className="absolute top-10 left-4 right-4 z-40 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20">
                                {(activeHighlight.coverImage || activeHighlight.imageUrl) ? (
                                    <Image
                                        src={activeHighlight.coverImage || activeHighlight.imageUrl}
                                        width={40}
                                        height={40}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-[#F44A22]" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white">{venueName}</p>
                                <p className="text-xs text-white/60">{activeHighlight.title}</p>
                            </div>
                            {isPaused && (
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Paused</span>
                            )}
                        </div>

                        {/* Story Content */}
                        {(() => {
                            const stories = activeHighlight.stories || [{ type: 'image', url: activeHighlight.coverImage || activeHighlight.imageUrl }];
                            const currentStory = stories[activeStoryIndex];

                            if (currentStory?.type === 'video') {
                                return (
                                    <video
                                        ref={videoRef}
                                        src={currentStory.url}
                                        className="absolute inset-0 w-full h-full object-contain"
                                        autoPlay
                                        muted={isMuted}
                                        playsInline
                                        onEnded={goToNextStory}
                                        onPause={() => setIsPaused(true)}
                                        onPlay={() => setIsPaused(false)}
                                    />
                                );
                            } else {
                                return (
                                    <Image
                                        src={currentStory?.url || activeHighlight.coverImage || activeHighlight.imageUrl || '/placeholder.jpg'}
                                        fill
                                        alt=""
                                        className="object-contain"
                                    />
                                );
                            }
                        })()}

                        {/* Bottom Actions */}
                        <div className="absolute bottom-8 left-4 right-4 z-40 flex items-center justify-between">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLike(activeHighlight.id, activeStoryIndex);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full"
                            >
                                <Heart
                                    className={`h-5 w-5 transition-colors ${liked[`${activeHighlight.id}-${activeStoryIndex}`] ? 'text-red-500 fill-current' : 'text-white'
                                        }`}
                                />
                                <span className="text-xs font-bold text-white">
                                    {(activeHighlight.likes || 0) + (liked[`${activeHighlight.id}-${activeStoryIndex}`] ? 1 : 0)}
                                </span>
                            </button>

                            {/* Video Controls */}
                            {(activeHighlight.stories?.[activeStoryIndex]?.type === 'video') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMuted(!isMuted);
                                    }}
                                    className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center"
                                >
                                    {isMuted ? (
                                        <VolumeX className="h-5 w-5 text-white" />
                                    ) : (
                                        <Volume2 className="h-5 w-5 text-white" />
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Navigation Hints */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 hidden md:block">
                            <button
                                onClick={(e) => { e.stopPropagation(); goToPrevStory(); }}
                                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5 text-white" />
                            </button>
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden md:block">
                            <button
                                onClick={(e) => { e.stopPropagation(); goToNextStory(); }}
                                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <ChevronRight className="h-5 w-5 text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-progress {
                    animation: progress 5s linear forwards;
                }
            `}</style>
        </>
    );
}
