import React from "react";

export function PharmaFlowLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2c2f33" />
          <stop offset="50%" stopColor="#70757a" />
          <stop offset="100%" stopColor="#1a1c1e" />
        </linearGradient>
        <filter id="brushed">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
        </filter>
      </defs>
      
      {/* The "P" Shape */}
      <path
        d="M30 20 H60 C80 20 80 55 60 55 H45 V80 H30 V20 Z"
        fill="url(#metalGradient)"
      />
      
      {/* The integrated cross/plus */}
      <path
        d="M45 40 H65 V55 H55 V65 H40 V55 H30 V40 H40 V30 H55 V40 Z"
        fill="#e2e8f0"
        fillRule="evenodd"
      />
      
      {/* Decorative metal lines for brushed look */}
      <rect x="30" y="20" width="50" height="60" fill="white" opacity="0.05" filter="url(#brushed)" />
    </svg>
  );
}
