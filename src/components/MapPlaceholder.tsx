'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';
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
      className="relative w-full h-full min-h-[320px] rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between"
    >
      {/* Top Map HUD Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 border border-zinc-200 text-xs font-semibold text-zinc-800 shadow-2xs">
          <Navigation className="h-3.5 w-3.5 text-zinc-900" />
          <span>NYC / Hudson River Corridor</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 border border-zinc-200 text-[11px] text-zinc-600 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Live Tracking</span>
        </div>
      </div>

      {/* Clean Minimalist Vector Canvas (Concourse aesthetic) */}
      <div className="absolute inset-0 bg-[#fafafa] flex items-center justify-center overflow-hidden">
        <svg
          className="w-full h-full object-cover"
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
        >
          {/* Subtle cartographic grid */}
          <pattern id="lightGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#lightGrid)" />

          {/* Hudson River neutral fill */}
          <path
            d="M 280,0 Q 270,120 290,200 T 285,400 L 370,400 Q 360,200 375,120 T 365,0 Z"
            fill="#e2e8f0"
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* NJ / NY Minimalist Region Labels */}
          <text x="120" y="50" fill="#94a3b8" fontSize="14" fontWeight="600" letterSpacing="3">
            NEW JERSEY
          </text>
          <text x="430" y="50" fill="#94a3b8" fontSize="14" fontWeight="600" letterSpacing="3">
            MANHATTAN
          </text>
          <text x="310" y="240" fill="#64748b" fontSize="10" fontWeight="500" letterSpacing="1">
            HUDSON RIVER
          </text>

          {/* Primary Route Path (Solid black/zinc line) */}
          <path
            d="M 160,240 C 220,240 260,210 330,210 C 400,210 420,160 480,140"
            fill="none"
            stroke="#18181b"
            strokeWidth={isPrimary ? "3.5" : "2"}
            strokeDasharray={isPrimary ? "none" : "4 4"}
            strokeLinecap="round"
          />

          {/* Plan B Route Path (Clean dashed line) */}
          <path
            d="M 160,240 C 180,180 240,160 330,160 C 410,160 430,145 480,140"
            fill="none"
            stroke="#71717a"
            strokeWidth={!isPrimary ? "3.5" : "2"}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />

          {/* Active vehicle indicator */}
          <circle cx="330" cy={isPrimary ? "210" : "160"} r="4.5" fill="#18181b" />
          <circle cx="330" cy={isPrimary ? "210" : "160"} r="2" fill="#ffffff" />

          {/* Origin Pin (Hoboken) */}
          <g transform="translate(160, 240)">
            <circle r="5" fill="#18181b" />
            <circle r="2" fill="#ffffff" />
            <text x="-40" y="20" fill="#18181b" fontSize="11" fontWeight="600">
              Hoboken Terminal
            </text>
          </g>

          {/* Destination Pin (Midtown / 33rd St) */}
          <g transform="translate(480, 140)">
            <circle r="5" fill="#18181b" />
            <circle r="2" fill="#ffffff" />
            <text x="-35" y="-12" fill="#18181b" fontSize="11" fontWeight="600">
              Midtown (Herald Sq)
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/95 border border-zinc-200 text-xs text-zinc-700 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-zinc-900" />
            <span className="text-[11px] font-medium">Primary: PATH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-zinc-400" />
            <span className="text-[11px] font-medium">Plan B: Ferry</span>
          </div>
        </div>

        <div className="pointer-events-auto px-2.5 py-1 rounded-lg bg-white/95 border border-zinc-200 text-[10px] text-zinc-500 font-mono shadow-2xs">
          Observer: {dimensions.width}x{dimensions.height}px
        </div>
      </div>
    </div>
  );
}
