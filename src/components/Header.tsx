'use client';

import React from 'react';
import { Compass, RefreshCw, Sun, Moon, SlidersHorizontal, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CommuteProfile } from '@/types/commute';

interface HeaderProps {
  currentProfile: CommuteProfile;
  profiles: CommuteProfile[];
  onSelectProfile: (profile: CommuteProfile) => void;
  activeScenario: 'normal' | 'delay' | 'reroute';
  onChangeScenario: (scenario: 'normal' | 'delay' | 'reroute') => void;
  onOpenSettings: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isReplayMode: boolean;
  onToggleReplay: () => void;
}

export function Header({
  currentProfile,
  profiles,
  onSelectProfile,
  activeScenario,
  onChangeScenario,
  onOpenSettings,
  theme,
  onToggleTheme,
  isReplayMode,
  onToggleReplay,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/80 border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Waypoint</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  NYC / NJ Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Confidence-aware journey risk engine • Nemotron + Nebius
              </p>
            </div>
          </div>

          {/* Mobile settings trigger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-slate-800/80 text-slate-300 border border-white/10 hover:bg-slate-700 transition"
              aria-label="Settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Corridor Selector & Replay Scenario Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Corridor Select */}
          <div className="relative">
            <select
              value={currentProfile.id}
              onChange={(e) => {
                const p = profiles.find((item) => item.id === e.target.value);
                if (p) onSelectProfile(p);
              }}
              className="bg-slate-900/90 text-sm font-medium text-slate-200 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none pr-8 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          {/* Scenario simulator (Replay switch for demo/judging) */}
          <div className="flex items-center rounded-lg bg-slate-900/90 border border-white/10 p-1 text-xs">
            <span className="text-slate-400 font-semibold px-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Replay:
            </span>
            <button
              onClick={() => onChangeScenario('normal')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                activeScenario === 'normal'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => onChangeScenario('delay')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                activeScenario === 'delay'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Delay
            </button>
            <button
              onClick={() => onChangeScenario('reroute')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                activeScenario === 'reroute'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Reroute
            </button>
          </div>

          {/* Preferences button */}
          <button
            onClick={onOpenSettings}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-sm font-medium text-slate-300 border border-white/10 hover:bg-slate-800 hover:text-white transition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>
    </header>
  );
}
