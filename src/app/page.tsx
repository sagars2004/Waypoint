'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { VerdictCard } from '@/components/VerdictCard';
import { DepartureTimeline } from '@/components/DepartureTimeline';
import { MapboxMap } from '@/components/MapboxMap';
import { ChatPanel } from '@/components/ChatPanel';
import { CommuteSettingsModal } from '@/components/CommuteSettingsModal';
import { Footer } from '@/components/Footer';
import { SAMPLE_PROFILES, SCENARIO_VERDICTS } from '@/data/mockCorridors';
import { CommuteProfile, RouteCandidate, Verdict } from '@/types/commute';
import { Radio } from 'lucide-react';

export default function Home() {
  const [profiles, setProfiles] = useState<CommuteProfile[]>(SAMPLE_PROFILES);
  const [currentProfile, setCurrentProfile] = useState<CommuteProfile>(SAMPLE_PROFILES[0]);
  const [activeScenario, setActiveScenario] = useState<'normal' | 'delay' | 'reroute'>('normal');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load saved profile from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('waypoint_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        window.requestAnimationFrame(() => setCurrentProfile(parsed));
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

  const [verdict, setVerdict] = useState<Verdict>(SCENARIO_VERDICTS.normal);
  const [selectedRoute, setSelectedRoute] = useState<RouteCandidate>(SCENARIO_VERDICTS.normal.primaryRoute);
  const [, setIsLoadingVerdict] = useState(false);

  // Fetch fresh deterministic verdict from API when profile or scenario changes
  useEffect(() => {
    let isMounted = true;
    async function loadVerdict() {
      setIsLoadingVerdict(true);
      try {
        const res = await fetch('/api/verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: activeScenario,
            profile: currentProfile,
          }),
        });
        const data = await res.json();
        if (isMounted && data.success && data.verdict) {
          setVerdict(data.verdict);
          setSelectedRoute(data.verdict.primaryRoute);
        }
      } catch (err) {
        console.warn('Fallback to local snapshot on error', err);
        if (isMounted) {
          const fallback = SCENARIO_VERDICTS[activeScenario];
          setVerdict(fallback);
          setSelectedRoute(fallback.primaryRoute);
        }
      } finally {
        if (isMounted) setIsLoadingVerdict(false);
      }
    }

    loadVerdict();
    return () => {
      isMounted = false;
    };
  }, [activeScenario, currentProfile]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans">
      {/* Navigation Header matching Concourse */}
      <Header
        currentProfile={currentProfile}
        profiles={profiles}
        onSelectProfile={(p) => setCurrentProfile(p)}
        activeScenario={activeScenario}
        onChangeScenario={(s) => setActiveScenario(s)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Corridor Status Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-zinc-900" />
            <span className="font-semibold text-zinc-900">{currentProfile.name}</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-600">Target Arrival: {currentProfile.arriveByTime} AM</span>
          </div>

          <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              PATH: Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              NJ Transit: Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              NY Waterway: Live
            </span>
          </div>
        </div>

        {/* Hero Section: Verdict Card (matches Concourse FlightStatus card) */}
        <VerdictCard
          verdict={verdict}
          onSelectRoute={(route) => setSelectedRoute(route)}
        />

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Interactive Map & Departure Timeline */}
          <div className="lg:col-span-7 space-y-6">
            {/* Interactive Mapbox GL Map with ResizeObserver container (Phase 5.1 & 5.2) */}
            <div className="h-[340px] w-full">
              <MapboxMap
                primaryRoute={verdict.primaryRoute}
                planBRoute={verdict.planBRoute}
                selectedRoute={selectedRoute}
                verdictState={verdict.state}
                originName={currentProfile.origin.name}
                destinationName={currentProfile.destination.name}
              />
            </div>

            {/* Departure Timeline with live countdown clock (Phase 5.3) */}
            <DepartureTimeline
              primaryRoute={verdict.primaryRoute}
              planBRoute={verdict.planBRoute}
              selectedRoute={selectedRoute}
              verdictState={verdict.state}
              onSelectRoute={(route) => setSelectedRoute(route)}
            />
          </div>

          {/* Right Column (5 cols): Chat Interface */}
          <div className="lg:col-span-5 h-[760px]">
            <ChatPanel
              verdict={verdict}
              profile={currentProfile}
              scenario={activeScenario}
            />
          </div>
        </div>
      </main>

      {/* Footer matching Concourse */}
      <Footer />

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
