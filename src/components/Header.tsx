'use client';

import React from 'react';
import { Navigation, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
  activeScenario: 'normal' | 'delay' | 'reroute';
  onChangeScenario: (scenario: 'normal' | 'delay' | 'reroute') => void;
  onOpenSettings: () => void;
}

export function Header({
  activeScenario,
  onChangeScenario,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-md">
      <div className="flex h-16 w-full max-w-6xl mx-auto items-center justify-between px-4 sm:px-6">
        {/* Left: Logo & Brand Name */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-2xs">
            <Navigation className="h-4 w-4" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 block leading-tight">
              Waypoint
            </span>
            <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline-block">
              NYC / NJ Commute Agent
            </span>
          </div>
        </div>

        {/* Center Tagline (matches Concourse) */}
        <div className="hidden lg:flex flex-1 justify-center text-center text-xs text-zinc-500">
          Built for the Nebius x NVIDIA Global AI Hackathon
        </div>

        {/* Right: Replay switcher */}
        <div className="flex items-center gap-2.5">
          {/* Minimalist Scenario Toggle */}
          <div className="flex items-center rounded-lg bg-zinc-100 border border-zinc-200 p-0.5 text-xs">
            <button
              onClick={() => onChangeScenario('normal')}
              className={`px-2 py-1 rounded-md font-medium transition ${
                activeScenario === 'normal'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => onChangeScenario('delay')}
              className={`px-2 py-1 rounded-md font-medium transition ${
                activeScenario === 'delay'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Delay
            </button>
            <button
              onClick={() => onChangeScenario('reroute')}
              className={`px-2 py-1 rounded-md font-medium transition ${
                activeScenario === 'reroute'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Reroute
            </button>
          </div>

          {/* Preferences Button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 text-xs font-medium transition flex items-center gap-1.5"
            aria-label="Commute Preferences"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preferences</span>
          </button>
        </div>
      </div>
    </header>
  );
}
