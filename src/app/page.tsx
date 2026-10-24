'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { VerdictCard } from '@/components/VerdictCard';
import { DepartureTimeline } from '@/components/DepartureTimeline';
import { MapboxMap } from '@/components/MapboxMap';
import { ChatPanel } from '@/components/ChatPanel';
import { CommuteSettingsModal } from '@/components/CommuteSettingsModal';
import { Footer } from '@/components/Footer';
import { SCENARIO_VERDICTS } from '@/data/mockCorridors';
import { CommuteProfile, RouteCandidate, Verdict } from '@/types/commute';
import { TransitStop } from '@/data/transitStops';
import { StopPicker } from '@/components/StopPicker';
import { TimePicker } from '@/components/TimePicker';
import { AIProductPanel } from '@/components/AIProductPanel';
import { formatTime12, timeToMinutes } from '@/lib/time';
import { Radio } from 'lucide-react';

const EMPTY_PROFILE: CommuteProfile = {
  id: 'onboarding',
  name: 'Choose your route',
  origin: { name: '' },
  destination: { name: '' },
  departAtTime: '',
  arriveByTime: '',
  acceptedModes: ['path', 'rail', 'ferry', 'bus'],
  preferences: {
    avoidTransfers: true,
    maxWalkingMinutes: 10,
    riskTolerance: 'balanced',
    allowFerries: true,
    allowDriving: false,
  },
};

function serviceName(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes('path')) return 'PATH';
  if (normalized.includes('lirr')) return 'LIRR';
  if (normalized.includes('mta') || normalized.includes('subway')) return 'MTA Subway';
  if (normalized.includes('njt') || normalized.includes('new jersey')) return 'NJ Transit';
  if (normalized.includes('ferry') || normalized.includes('waterway')) return 'NY Waterway';
  if (normalized.includes('bus')) return 'Transit Bus';
  if (normalized.includes('driv')) return 'Driving';
  return line;
}

export default function Home() {
  const [currentProfile, setCurrentProfile] = useState<CommuteProfile>(EMPTY_PROFILE);
  const [activeScenario, setActiveScenario] = useState<'normal' | 'delay' | 'reroute'>('normal');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [locationErrors, setLocationErrors] = useState<{ origin?: string; destination?: string }>({});
  const [scheduleError, setScheduleError] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteCandidate | null>(null);
  const [, setIsLoadingVerdict] = useState(false);

  const handleSaveProfile = (updated: CommuteProfile) => {
    setVerdict(null);
    setSelectedRoute(null);
    setCurrentProfile(updated);
    try {
      localStorage.setItem('waypoint_profile', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save profile', e);
    }
  };

  const handleLocationChange = (field: 'origin' | 'destination', stop: TransitStop) => {
    const other = field === 'origin' ? currentProfile.destination : currentProfile.origin;
    const sameCoordinates = Boolean(
      other.coordinates && stop.coordinates &&
      other.coordinates[0] === stop.coordinates[0] &&
      other.coordinates[1] === stop.coordinates[1]
    );
    if (other.stopId === stop.id || sameCoordinates) {
      setLocationErrors((current) => ({
        ...current,
        [field]: 'Choose a different stop from the other end of the route.',
      }));
      return;
    }

    setLocationErrors((current) => ({ ...current, [field]: undefined }));
    const nextOrigin = field === 'origin' ? stop.name : currentProfile.origin.name;
    const nextDestination = field === 'destination' ? stop.name : currentProfile.destination.name;
    handleSaveProfile({
      ...currentProfile,
      name: `${nextOrigin} → ${nextDestination}`,
      [field]: {
        name: stop.name,
        coordinates: stop.coordinates,
        stopId: stop.id,
        agency: stop.agency,
        mode: stop.mode,
      },
    });
  };

  const handleScheduleChange = (field: 'departAtTime' | 'arriveByTime', value: string) => {
    const nextProfile = { ...currentProfile, [field]: value };
    const hasBothTimes = Boolean(nextProfile.departAtTime && nextProfile.arriveByTime);
    const hasValidOrder = timeToMinutes(nextProfile.departAtTime) < timeToMinutes(nextProfile.arriveByTime);
    setScheduleError(hasBothTimes && !hasValidOrder ? 'Arrival time must be later than the departure time.' : '');
    handleSaveProfile(nextProfile);
  };

  const hasRequiredSelections = Boolean(
    currentProfile.origin.stopId &&
    currentProfile.destination.stopId &&
    currentProfile.departAtTime &&
    currentProfile.arriveByTime
  );
  const isScheduleValid = hasRequiredSelections &&
    timeToMinutes(currentProfile.departAtTime) < timeToMinutes(currentProfile.arriveByTime);
  const isPlanReady = hasRequiredSelections && isScheduleValid && !locationErrors.origin && !locationErrors.destination;

  // Fetch fresh deterministic verdict from API when profile or scenario changes
  useEffect(() => {
    let isMounted = true;
    if (!isPlanReady) {
      return () => {
        isMounted = false;
      };
    }

    async function loadVerdict() {
      setIsLoadingVerdict(true);
      setVerdict(null);
      setSelectedRoute(null);
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
  }, [activeScenario, currentProfile, isPlanReady]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col font-sans">
      {/* Navigation Header matching Concourse */}
      <Header
        activeScenario={activeScenario}
        onChangeScenario={(s) => setActiveScenario(s)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Primary route selection lives on the dashboard. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-1 mb-3">
            <h1 className="text-sm font-bold text-zinc-900">Plan a commute</h1>
          <p className="text-xs text-zinc-500">Search by stop, location, or agency, then choose when you want to leave and arrive.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StopPicker label="Origin" value={currentProfile.origin} error={locationErrors.origin} onChange={(stop) => handleLocationChange('origin', stop)} />
            <StopPicker label="Destination" value={currentProfile.destination} error={locationErrors.destination} onChange={(stop) => handleLocationChange('destination', stop)} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <TimePicker
                id="depart-at-time"
                label="Leave at"
                value={currentProfile.departAtTime ?? ''}
                onChange={(value) => handleScheduleChange('departAtTime', value)}
                placeholder="Select a departure time"
              />
            </div>
            <div>
              <TimePicker
                id="arrive-by-time"
                label="Arrive by"
                value={currentProfile.arriveByTime}
                onChange={(value) => handleScheduleChange('arriveByTime', value)}
                placeholder="Select an arrival target"
              />
            </div>
          </div>
          {scheduleError && <p className="mt-2 text-[11px] font-medium text-red-600">{scheduleError}</p>}
          {!isPlanReady && !scheduleError && (
            <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-blue-800">
              Select an origin, destination, departure time, and arrival target to see route results.
            </p>
          )}
        </section>

        <AIProductPanel />

        {isPlanReady && verdict && selectedRoute && (
          <>
            {/* Top Corridor Status Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-zinc-900" />
                <span className="font-semibold text-zinc-900">{currentProfile.name}</span>
                <span className="text-zinc-400">•</span>
                <span className="text-zinc-600">Leave {formatTime12(currentProfile.departAtTime)} · Arrive by {formatTime12(currentProfile.arriveByTime)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-zinc-500 text-[11px]">
                {Array.from(new Set(verdict.primaryRoute.legs
                  .filter((leg) => !leg.line.toLowerCase().includes('walk'))
                  .map((leg) => serviceName(leg.line)))).map((service) => (
                  <span key={service} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{service}: Live</span>
                ))}
              </div>
            </div>

            {/* Hero Section: Verdict Card */}
            <VerdictCard
              verdict={verdict}
              targetArrivalTime={currentProfile.arriveByTime}
              onSelectRoute={(route) => setSelectedRoute(route)}
            />

            {/* 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Interactive Map & Departure Timeline */}
              <div className="lg:col-span-7 space-y-6">
            {/* Interactive Mapbox GL Map with ResizeObserver container (Phase 5.1 & 5.2) */}
                <div className="h-[560px] w-full">
                  <MapboxMap
                    primaryRoute={verdict.primaryRoute}
                    planBRoute={verdict.planBRoute}
                    selectedRoute={selectedRoute}
                    verdictState={verdict.state}
                    originName={currentProfile.origin.name}
                    destinationName={currentProfile.destination.name}
                    originCoordinates={currentProfile.origin.coordinates}
                    destinationCoordinates={currentProfile.destination.coordinates}
                  />
                </div>
            </div>

              {/* Right Column (5 cols): Chat Interface */}
              <div className="lg:col-span-5 h-[560px]">
                <ChatPanel verdict={verdict} profile={currentProfile} scenario={activeScenario} />
              </div>

              {/* Full-width departure timeline aligns with the page container. */}
              <div className="lg:col-span-12">
                <DepartureTimeline
                  primaryRoute={verdict.primaryRoute}
                  planBRoute={verdict.planBRoute}
                  selectedRoute={selectedRoute}
                  verdictState={verdict.state}
                  onSelectRoute={(route) => setSelectedRoute(route)}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer matching Concourse */}
      <Footer />

      {/* Preferences Modal */}
      <CommuteSettingsModal
        key={currentProfile.id}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={currentProfile}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}
