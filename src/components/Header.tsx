'use client';

import React from 'react';
import { Navigation, SlidersHorizontal, Radio } from 'lucide-react';
import { CommuteProfile } from '@/types/commute';

interface HeaderProps {
  currentProfile: CommuteProfile;
  profiles: CommuteProfile[];
  onSelectProfile: (profile: CommuteProfile) => void;
  activeScenario: 'normal' | 'delay' | 'reroute';
  onChangeScenario: (scenario: 'normal' | 'delay' | 'reroute') => void;
  onOpenSettings: () => void;
}

export function Header({
  currentProfile,
  profiles,
  onSelectProfile,
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

        {/* Right: Corridor & Replay Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Corridor Dropdown */}
          <div className="relative">
            <select
              value={currentProfile.id}
              onChange={(e) => {
                const p = profiles.find((item) => item.id === e.target.value);
                if (p) onSelectProfile(p);
              }}
              className="bg-zinc-50 text-xs font-medium text-zinc-800 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-900 appearance-none pr-7 cursor-pointer hover:bg-zinc-100 transition"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

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
