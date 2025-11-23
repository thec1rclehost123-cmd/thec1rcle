"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageLoadingAnimation() {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(false);
    const [prevPathname, setPrevPathname] = useState(pathname);
    const [loadProgress, setLoadProgress] = useState(0);

    useEffect(() => {
        if (pathname !== prevPathname) {
            setIsLoading(true);
            setLoadProgress(0);
            setPrevPathname(pathname);
        }
    }, [pathname, prevPathname]);

    useEffect(() => {
        if (isLoading) {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setLoadProgress((prev) => {
                    if (prev >= 90) return prev;
                    return prev + Math.random() * 15;
                });
            }, 100);

            // Check page ready
            const checkPageReady = () => {
                if (document.readyState === 'complete') {
                    setLoadProgress(100);
                    setTimeout(() => {
                        setIsLoading(false);
                    }, 600);
                } else {
                    setTimeout(checkPageReady, 50);
                }
            };
            checkPageReady();

            return () => clearInterval(progressInterval);
        }
    }, [isLoading]);

    return (
        <AnimatePresence mode="wait">
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.5 } }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] bg-black overflow-hidden"
                >
                    {/* Animated Scanlines */}
                    <div className="absolute inset-0 opacity-10">
                        {[...Array(40)].map((_, i) => (
                            <motion.div
                                key={`scanline-${i}`}
                                className="h-px bg-cyan-400"
                                style={{ top: `${i * 2.5}%` }}
                                animate={{ opacity: [0.1, 0.5, 0.1] }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.05,
                                }}
                            />
                        ))}
                    </div>

                    {/* Hexagonal Grid Background */}
                    <div className="absolute inset-0 opacity-5">
                        <svg width="100%" height="100%">
                            <defs>
                                <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                                    <polygon points="24.8,22 37.3,29.2 37.3,43.7 24.8,50.9 12.3,43.7 12.3,29.2" fill="none" stroke="rgba(0,255,255,0.3)" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#hexagons)" />
                        </svg>
                    </div>

                    {/* Particle Stream */}
                    <div className="absolute inset-0 overflow-hidden">
                        {[...Array(30)].map((_, i) => (
                            <motion.div
                                key={`particle-${i}`}
                                className="absolute w-1 h-1 rounded-full"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    background: i % 3 === 0 ? '#0ff' : i % 3 === 1 ? '#f0f' : '#fff',
                                    boxShadow: `0 0 10px ${i % 3 === 0 ? '#0ff' : i % 3 === 1 ? '#f0f' : '#fff'}`,
                                }}
                                animate={{
                                    y: ['0vh', '100vh'],
                                    opacity: [0, 1, 1, 0],
                                    scale: [0, 1, 1, 0],
                                }}
                                transition={{
                                    duration: 2 + Math.random() * 2,
                                    repeat: Infinity,
                                    delay: Math.random() * 2,
                                    ease: "linear",
                                }}
                            />
                        ))}
                    </div>

                    {/* Central Holographic Display */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-80 h-80">

                            {/* Rotating Ring System */}
                            {[0, 1, 2].map((index) => (
                                <motion.div
                                    key={`ring-${index}`}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                                    style={{
                                        width: 120 + index * 60,
                                        height: 120 + index * 60,
                                        border: `2px solid transparent`,
                                        borderTopColor: index === 0 ? '#0ff' : index === 1 ? '#f0f' : '#fff',
                                        borderRightColor: index === 0 ? '#0ff' : index === 1 ? '#f0f' : '#fff',
                                        filter: `drop-shadow(0 0 10px ${index === 0 ? '#0ff' : index === 1 ? '#f0f' : '#fff'})`,
                                    }}
                                    animate={{
                                        rotate: index % 2 === 0 ? 360 : -360,
                                    }}
                                    transition={{
                                        duration: 3 - index * 0.5,
                                        repeat: Infinity,
                                        ease: "linear",
                                    }}
                                />
                            ))}

                            {/* Orbiting Energy Nodes */}
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                <motion.div
                                    key={`node-${index}`}
                                    className="absolute top-1/2 left-1/2"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        marginTop: -6,
                                        marginLeft: -6,
                                    }}
                                    animate={{
                                        x: [
                                            100 * Math.cos((index * Math.PI * 2) / 6),
                                            100 * Math.cos((index * Math.PI * 2) / 6 + Math.PI * 2),
                                        ],
                                        y: [
                                            100 * Math.sin((index * Math.PI * 2) / 6),
                                            100 * Math.sin((index * Math.PI * 2) / 6 + Math.PI * 2),
                                        ],
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "linear",
                                    }}
                                >
                                    <div
                                        className="w-full h-full rounded-full"
                                        style={{
                                            background: index % 2 === 0 ? '#0ff' : '#f0f',
                                            boxShadow: `0 0 20px ${index % 2 === 0 ? '#0ff' : '#f0f'}`,
                                        }}
                                    />
                                </motion.div>
                            ))}

                            {/* Center Core with Glitch Effect */}
                            <motion.div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                style={{ width: 100, height: 100 }}
                            >
                                {/* Glitching layers */}
                                {[0, 1, 2].map((glitchIndex) => (
                                    <motion.div
                                        key={`glitch-${glitchIndex}`}
                                        className="absolute inset-0 rounded-lg border-2 flex items-center justify-center"
                                        style={{
                                            borderColor: glitchIndex === 0 ? '#0ff' : glitchIndex === 1 ? '#f0f' : '#fff',
                                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                            backdropFilter: 'blur(10px)',
                                        }}
                                        animate={{
                                            x: [0, -2, 2, -1, 1, 0],
                                            y: [0, 1, -1, 2, -2, 0],
                                            opacity: [1, 0.8, 1, 0.8, 1],
                                        }}
                                        transition={{
                                            duration: 0.3,
                                            repeat: Infinity,
                                            delay: glitchIndex * 0.1,
                                        }}
                                    >
                                        {glitchIndex === 0 && (
                                            <div className="text-center">
                                                <motion.div
                                                    className="text-3xl font-black tracking-tighter mb-1"
                                                    style={{
                                                        background: 'linear-gradient(45deg, #0ff, #f0f, #fff)',
                                                        WebkitBackgroundClip: 'text',
                                                        WebkitTextFillColor: 'transparent',
                                                        filter: 'drop-shadow(0 0 10px rgba(0,255,255,0.5))',
                                                    }}
                                                    animate={{
                                                        textShadow: [
                                                            '0 0 10px #0ff',
                                                            '0 0 20px #f0f',
                                                            '0 0 10px #0ff',
                                                        ],
                                                    }}
                                                    transition={{
                                                        duration: 1,
                                                        repeat: Infinity,
                                                    }}
                                                >
                                                    C1
                                                </motion.div>
                                                <div className="text-[8px] text-cyan-400 font-mono tracking-widest">
                                                    LOADING
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </motion.div>

                            {/* Pulsing Energy Field */}
                            <motion.div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                                style={{
                                    width: 200,
                                    height: 200,
                                    background: 'radial-gradient(circle, rgba(0,255,255,0.2), transparent 70%)',
                                    filter: 'blur(20px)',
                                }}
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.3, 0.6, 0.3],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                            />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-96 max-w-[80vw]">
                        <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{
                                    background: 'linear-gradient(90deg, #0ff, #f0f, #fff)',
                                    boxShadow: '0 0 20px rgba(0,255,255,0.8)',
                                }}
                                animate={{
                                    width: `${loadProgress}%`,
                                }}
                                transition={{
                                    duration: 0.3,
                                }}
                            />
                            {/* Glowing edge */}
                            <motion.div
                                className="absolute inset-y-0 w-2 rounded-full blur-sm"
                                style={{
                                    left: `${loadProgress}%`,
                                    background: '#fff',
                                    boxShadow: '0 0 10px #fff',
                                }}
                            />
                        </div>

                        {/* Progress Text */}
                        <motion.div
                            className="flex justify-between mt-3 font-mono text-xs"
                            animate={{
                                opacity: [0.5, 1, 0.5],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                            }}
                        >
                            <span className="text-cyan-400">INITIALIZING</span>
                            <span className="text-white">{Math.round(loadProgress)}%</span>
                        </motion.div>
                    </div>

                    {/* Corner Brackets - HUD Style */}
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
                        <motion.div
                            key={corner}
                            className={`absolute ${corner.includes('top') ? 'top-8' : 'bottom-8'} ${corner.includes('left') ? 'left-8' : 'right-8'}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <svg width="40" height="40" className="text-cyan-400">
                                <path
                                    d={
                                        corner === 'top-left' ? 'M 0 10 L 0 0 L 10 0' :
                                            corner === 'top-right' ? 'M 30 0 L 40 0 L 40 10' :
                                                corner === 'bottom-left' ? 'M 0 30 L 0 40 L 10 40' :
                                                    'M 30 40 L 40 40 L 40 30'
                                    }
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    filter="drop-shadow(0 0 5px currentColor)"
                                />
                            </svg>
                        </motion.div>
                    ))}

                    {/* Binary Data Stream */}
                    <div className="absolute top-8 right-20 font-mono text-[10px] text-cyan-400/40 space-y-1">
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={`binary-${i}`}
                                animate={{
                                    opacity: [0.2, 0.6, 0.2],
                                }}
                                transition={{
                                    duration: 0.5,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                }}
                            >
                                {Array.from({ length: 20 }, () => Math.random() > 0.5 ? '1' : '0').join('')}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
