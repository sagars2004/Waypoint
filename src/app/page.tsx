'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { VerdictCard } from '@/components/VerdictCard';
import { DepartureTimeline } from '@/components/DepartureTimeline';
import { MapView } from '@/components/MapPlaceholder';
import { ChatPanel } from '@/components/ChatPanel';
import { CommuteSettingsModal } from '@/components/CommuteSettingsModal';
import { SAMPLE_PROFILES, SCENARIO_VERDICTS } from '@/data/mockCorridors';
import { CommuteProfile, RouteCandidate, Verdict } from '@/types/commute';
import { Radio, Activity, ShieldCheck, Database, Layers } from 'lucide-react';

export default function Home() {
  const [profiles, setProfiles] = useState<CommuteProfile[]>(SAMPLE_PROFILES);
  const [currentProfile, setCurrentProfile] = useState<CommuteProfile>(SAMPLE_PROFILES[0]);
  const [activeScenario, setActiveScenario] = useState<'normal' | 'delay' | 'reroute'>('normal');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReplayMode, setIsReplayMode] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load saved profile from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('waypoint_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCurrentProfile(parsed);
      }
    } catch (e) {
      console.warn('Could not read saved profile', e);
    }
  }, []);

  const handleSaveProfile = (updated: CommuteProfile) => {
    setCurrentProfile(updated);
    setProfiles((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    try {
      localStorage.setItem('waypoint_profile', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save profile', e);
    }
  };

  const verdict: Verdict = SCENARIO_VERDICTS[activeScenario];
  const [selectedRoute, setSelectedRoute] = useState<RouteCandidate>(verdict.primaryRoute);

  // Sync selected route whenever scenario changes
  useEffect(() => {
    setSelectedRoute(verdict.primaryRoute);
  }, [activeScenario, verdict]);

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Header */}
      <Header
        currentProfile={currentProfile}
        profiles={profiles}
        onSelectProfile={(p) => setCurrentProfile(p)}
        activeScenario={activeScenario}
        onChangeScenario={(s) => setActiveScenario(s)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        isReplayMode={isReplayMode}
        onToggleReplay={() => setIsReplayMode(!isReplayMode)}
      />

      {/* Main Bento Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Corridor Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span className="font-semibold text-slate-200">{currentProfile.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Target Arrival: {currentProfile.arriveByTime} AM</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              PATH: Fresh
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              NJT: Fresh
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Waterway: Fresh
            </span>
          </div>
        </div>

        {/* Hero Section: Verdict Card */}
        <VerdictCard
          verdict={verdict}
          onSelectRoute={(route) => setSelectedRoute(route)}
        />

        {/* Bento Grid: 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Interactive Map & Departure Timeline */}
          <div className="lg:col-span-7 space-y-6">
            {/* Interactive Map with ResizeObserver container */}
            <div className="h-[360px] w-full">
              <MapView
                primaryRoute={verdict.primaryRoute}
                planBRoute={verdict.planBRoute}
                selectedRoute={selectedRoute}
                originName={currentProfile.origin.name}
                destinationName={currentProfile.destination.name}
              />
            </div>

            {/* Departure Timeline & Journey Risk */}
            <DepartureTimeline
              primaryRoute={verdict.primaryRoute}
              planBRoute={verdict.planBRoute}
              selectedRoute={selectedRoute}
              onSelectRoute={(route) => setSelectedRoute(route)}
            />
          </div>

          {/* Right Column (5 cols): AI Chat Assistant & Grounded Follow-ups */}
          <div className="lg:col-span-5 h-[760px]">
            <ChatPanel verdict={verdict} />
          </div>
        </div>
      </main>

      {/* Footer & Telemetry Strip */}
      <footer className="w-full border-t border-white/10 bg-slate-950/70 py-4 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Waypoint</span>
            <span>• Multimodal NYC/NJ Commute Agent</span>
            <span>• Nebius x NVIDIA Hackathon</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-cyan-400" />
              Nemotron 3 Ultra (Orchestrator)
            </span>
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3 text-emerald-400" />
              Replay Fixture F9
            </span>
          </div>
        </div>
      </footer>

      {/* Preferences Modal */}
      <CommuteSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={currentProfile}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}
