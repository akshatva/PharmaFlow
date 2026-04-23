"use client"
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/lib/utils"

interface TextItem {
    text: string;
    image: string;
}

interface CircularRevealHeadingProps {
    items: TextItem[];
    centerText: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
    sm: {
        container: 'h-[300px] w-[300px]',
        fontSize: 'text-[10px]',
        tracking: 'tracking-[0.2em]',
        radius: 120,
        gap: 15,
        imageSize: 'w-[80%] h-[80%]',
        textStyle: 'font-semibold'
    },
    md: {
        container: 'h-[450px] w-[450px]',
        fontSize: 'text-[11px]',
        tracking: 'tracking-[0.25em]',
        radius: 180,
        gap: 12,
        imageSize: 'w-[82%] h-[82%]',
        textStyle: 'font-semibold',
    },
    lg: {
        container: 'h-[600px] w-[600px]',
        fontSize: 'text-xs',
        tracking: 'tracking-[0.3em]',
        radius: 240,
        gap: 10,
        imageSize: 'w-[85%] h-[85%]',
        textStyle: 'font-semibold'
    }
};

const usePreloadImages = (images: string[]) => {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const loadImage = (url: string): Promise<void> =>
            new Promise((resolve) => {
                const img = new Image();
                img.src = url;
                img.onload = () => resolve();
                img.onerror = () => resolve(); // Resolve even on error to not block preloading state
            });

        Promise.all(images.map(loadImage))
            .then(() => setLoaded(true));
    }, [images]);

    return loaded;
};

const ImagePreloader = ({ images }: { images: string[] }) => (
    <div className="hidden" aria-hidden="true">
        {images.map((src, index) => (
            <img key={index} src={src} alt="" />
        ))}
    </div>
);

const ImageOverlay = ({ image, size = 'md' }: { image: string, size?: 'sm' | 'md' | 'lg' }) => (
    <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
    >
        <motion.img
            src={image}
            alt=""
            className={cn(
                sizeConfig[size].imageSize,
                "object-cover rounded-full shadow-2xl transition-all duration-700"
            )}
        />
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-slate-950/20 to-transparent pointer-events-none" />
    </motion.div>
);

export const CircularRevealHeading = ({
    items,
    centerText,
    className,
    size = 'md'
}: CircularRevealHeadingProps) => {
    const [activeImage, setActiveImage] = useState<string | null>(null);
    const config = sizeConfig[size];
    const imagesLoaded = usePreloadImages(items.map(item => item.image));

    const createTextSegments = () => {
        const totalItems = items.length;
        const totalGapDegrees = config.gap * totalItems;
        const availableDegrees = 360 - totalGapDegrees;
        const segmentDegrees = availableDegrees / totalItems;
        
        return items.map((item, index) => {
            const startPosition = index * (segmentDegrees + config.gap);
            const startOffset = `${(startPosition / 360) * 100}%`;
            return (
                <g key={index}>
                    <text
                        className={cn(
                            config.fontSize,
                            config.tracking,
                            config.textStyle,
                            "uppercase cursor-pointer transition-all duration-500"
                        )}
                        onMouseEnter={() => imagesLoaded && setActiveImage(item.image)}
                        onMouseLeave={() => setActiveImage(null)}
                    >
                        <textPath
                            href="#curve"
                            className="fill-slate-500 hover:fill-slate-950 transition-colors duration-300"
                            startOffset={startOffset}
                            textLength={`${segmentDegrees * 2.5}`}
                            lengthAdjust="spacingAndGlyphs"
                        >
                            {item.text}
                        </textPath>
                    </text>
                </g>
            );
        });
    };

    return (
        <div className={cn("flex items-center justify-center", className)}>
            <ImagePreloader images={items.map(item => item.image)} />
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className={cn(
                    "relative overflow-hidden group",
                    config.container,
                    "rounded-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300",
                    "border-4 border-slate-300/50 shadow-[20px_20px_60px_#d1d1d1,-20px_-20px_60px_#ffffff,inset_0_0_40px_rgba(255,255,255,0.5)]",
                    "backdrop-blur-sm"
                )}
            >
                {/* Brushed Metal Texture Effect */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')] mix-blend-overlay" />

                {/* Layered Metallic Borders */}
                <div className="absolute inset-0 rounded-full border border-white/80 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <div className="absolute inset-[4px] rounded-full border border-slate-400/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]" />

                {/* Metallic shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-gradient-to-tr from-transparent via-white/60 to-transparent -translate-x-full group-hover:translate-x-full transform ease-in-out" style={{ transitionDuration: '2s' }} />

                <AnimatePresence>
                    {activeImage && imagesLoaded && (
                        <ImageOverlay image={activeImage} size={size} />
                    )}
                </AnimatePresence>

                {/* Intricate Inner Metallic Rings */}
                <div className="absolute inset-[12px] rounded-full border-2 border-slate-300/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]" />
                <div className="absolute inset-[14px] rounded-full border border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                <div className="absolute inset-[24px] rounded-full border border-slate-200/50 bg-slate-50/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]" />

                <div className="absolute inset-0 flex items-center justify-center">
                    <AnimatePresence>
                        {!activeImage && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.4 }}
                                className="relative z-10 text-center"
                            >
                                {centerText}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 60,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                >
                    <svg viewBox="0 0 500 500" className="w-full h-full pointer-events-auto">
                        <path
                            id="curve"
                            fill="none"
                            d={`M 250,250 m -${config.radius},0 a ${config.radius},${config.radius} 0 1,1 ${config.radius * 2},0 a ${config.radius},${config.radius} 0 1,1 -${config.radius * 2},0`}
                        />
                        {createTextSegments()}
                    </svg>
                </motion.div>
            </motion.div>
        </div>
    );
};
