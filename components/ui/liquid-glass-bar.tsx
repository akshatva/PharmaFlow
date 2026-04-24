"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassBarProps {
  children?: React.ReactNode;
  className?: string;
  scrolled?: boolean;
}

export function LiquidGlassBar({ children, className, scrolled }: LiquidGlassBarProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex items-center justify-between transition-all duration-700 ease-in-out",
        "h-[72px] rounded-full",
        // Base Glass Material - Highly transparent with extreme blur
        "bg-cyan-950/15 backdrop-blur-[48px] saturate-[200%]",
        // Rim Light & Sharp Border
        "border border-white/30",
        // Multi-layered depth with internal refraction
        "shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_2px_rgba(0,0,0,0.3)]",
        scrolled ? "max-w-[420px] px-6" : "max-w-5xl px-8",
        className
      )}
    >
      {/* Caustic / Ripple Overlay */}
      <div className="absolute inset-0 rounded-full opacity-40 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-[-100%] bg-[radial-gradient(circle_at_50%_50%,rgba(200,255,255,0.2),transparent_60%)] animate-[spin_15s_linear_infinite]" 
          style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')", backgroundSize: "150px", filter: "contrast(200%) brightness(150%)" }}
        />
      </div>

      {/* Primary Gloss Highlight (Specular) */}
      <div className="absolute inset-x-8 top-1 h-[3px] rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent blur-[0.5px] mix-blend-overlay" />
      
      {/* Secondary Rim Light (Side) */}
      <div className="absolute inset-y-4 left-2 w-[2px] rounded-full bg-white/20 blur-[1px]" />
      
      {/* Bottom refraction line */}
      <div className="absolute inset-x-12 bottom-1.5 h-[1px] bg-white/10 blur-[0.5px]" />

      {/* Inner Glow Overlay */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none" />

      <div className="relative z-10 flex w-full items-center justify-between">
        {children}
      </div>
    </div>
  );
}
