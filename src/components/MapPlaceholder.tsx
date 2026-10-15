'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MapPin, Navigation, Layers, Maximize2, Compass } from 'lucide-react';
import { RouteCandidate } from '@/types/commute';

interface MapViewProps {
  primaryRoute: RouteCandidate;
  planBRoute?: RouteCandidate;
  selectedRoute: RouteCandidate;
  originName: string;
  destinationName: string;
}

export function MapView({
  primaryRoute,
  planBRoute,
  selectedRoute,
  originName,
  destinationName,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Lesson from Concourse & PRD: ResizeObserver hook so map resizes correctly in bento grid & theme change
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isPrimary = selectedRoute.id === primaryRoute.id;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[340px] rounded-2xl glass-panel overflow-hidden border border-white/10 flex flex-col justify-between"
    >
      {/* Top Map HUD Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-200 shadow-lg">
          <Navigation className="h-3.5 w-3.5 text-cyan-400" />
          <span>NYC / Hudson River Corridor</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Live Tracking</span>
        </div>
      </div>

      {/* Stylized Transit Route Vector Canvas / Visualizer */}
      <div className="absolute inset-0 bg-[#090d16] flex items-center justify-center overflow-hidden">
        {/* Subtle Hudson River & Shoreline Graphic */}
        <svg
          className="w-full h-full object-cover opacity-80"
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#082f49" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="primaryPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="planBGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
          </defs>

          {/* Grid lines for cartographic aesthetic */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Hudson River stylized polygon */}
          <path
            d="M 280,0 Q 270,120 290,200 T 285,400 L 370,400 Q 360,200 375,120 T 365,0 Z"
            fill="url(#waterGrad)"
            stroke="rgba(14, 165, 233, 0.15)"
            strokeWidth="1"
          />

          {/* NJ / NY Labels */}
          <text x="120" y="50" fill="rgba(148, 163, 184, 0.25)" fontSize="18" fontWeight="bold" letterSpacing="4">
            NEW JERSEY
          </text>
          <text x="430" y="50" fill="rgba(148, 163, 184, 0.25)" fontSize="18" fontWeight="bold" letterSpacing="4">
            MANHATTAN
          </text>
          <text x="310" y="240" fill="rgba(56, 189, 248, 0.35)" fontSize="10" fontWeight="600" letterSpacing="2">
            HUDSON RIVER
          </text>

          {/* Primary Route Path (PATH Tunnel under Hudson) */}
          <path
            d="M 160,240 C 220,240 260,210 330,210 C 400,210 420,160 480,140"
            fill="none"
            stroke="url(#primaryPathGrad)"
            strokeWidth={isPrimary ? "4.5" : "2.5"}
            strokeDasharray={isPrimary ? "none" : "4 4"}
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Plan B Route Path (Ferry over Hudson + Cross-town) */}
          <path
            d="M 160,240 C 180,180 240,160 330,160 C 410,160 430,145 480,140"
            fill="none"
            stroke="url(#planBGrad)"
            strokeWidth={!isPrimary ? "4.5" : "2"}
            strokeDasharray={!isPrimary ? "none" : "6 4"}
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Animated pulsing transit vehicle icon along the active line */}
          <circle cx="330" cy={isPrimary ? "210" : "160"} r="6" fill="#38bdf8" className="animate-ping opacity-75" />
          <circle cx="330" cy={isPrimary ? "210" : "160"} r="4" fill="#ffffff" />

          {/* Origin Pin (Hoboken) */}
          <g transform="translate(160, 240)">
            <circle r="8" fill="#0284c7" opacity="0.3" className="animate-pulse" />
            <circle r="5" fill="#38bdf8" />
            <circle r="2" fill="#ffffff" />
            <text x="-40" y="22" fill="#e2e8f0" fontSize="11" fontWeight="600">
              Hoboken Terminal
            </text>
          </g>

          {/* Destination Pin (Midtown / 33rd St) */}
          <g transform="translate(480, 140)">
            <circle r="8" fill="#10b981" opacity="0.3" className="animate-pulse" />
            <circle r="5" fill="#34d399" />
            <circle r="2" fill="#ffffff" />
            <text x="-35" y="-14" fill="#e2e8f0" fontSize="11" fontWeight="600">
              Midtown (Herald Sq)
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-sky-400" />
            <span className="text-[11px] font-medium">Primary: PATH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-teal-400" />
            <span className="text-[11px] font-medium">Plan B: Ferry</span>
          </div>
        </div>

        <div className="pointer-events-auto px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-[10px] text-slate-400 font-mono">
          Observer: {dimensions.width}x{dimensions.height}px
        </div>
      </div>
    </div>
  );
}
