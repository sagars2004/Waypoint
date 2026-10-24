'use client';

import React, { useState, useEffect } from 'react';
import { 
  Train, 
  Ship, 
  Bus, 
  Car, 
  Footprints, 
  ArrowRight, 
  Clock, 
  ShieldCheck,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { RouteCandidate, VerdictState } from '@/types/commute';
import { formatTime12 } from '@/lib/time';

interface DepartureTimelineProps {
  primaryRoute: RouteCandidate;
  planBRoute?: RouteCandidate;
  selectedRoute: RouteCandidate;
  verdictState?: VerdictState;
  onSelectRoute: (route: RouteCandidate) => void;
}

// Parse "HH:MM" into today's Date for countdown calculation
function parseTimeToday(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  // If past midnight reference, bump to tomorrow
  if (d.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatCountdown(totalSeconds: number): { display: string; urgent: boolean; passed: boolean } {
  if (totalSeconds < 0) {
    return { display: 'Departed', urgent: false, passed: true };
  }
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const urgent = totalSeconds < 5 * 60; // under 5 minutes

  if (hrs > 0) {
    return { display: `${hrs}h ${mins}m`, urgent, passed: false };
  }
  if (mins > 0) {
    return { display: `${mins}m ${secs.toString().padStart(2, '0')}s`, urgent, passed: false };
  }
  return { display: `${secs}s`, urgent: true, passed: false };
}

function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

function shiftRouteSchedule(route: RouteCandidate, offsetMinutes: number): RouteCandidate {
  const shift = (value: string) => {
    const normalized = ((clockMinutes(value) + offsetMinutes) % 1440 + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  };

  return {
    ...route,
    departureTime: shift(route.departureTime),
    arrivalTime: shift(route.arrivalTime),
    legs: route.legs.map((leg) => ({
      ...leg,
      departureTime: shift(leg.departureTime),
      arrivalTime: shift(leg.arrivalTime),
    })),
  };
}

function routeHeadwayMinutes(route: RouteCandidate): number {
  const mode = route.legs.find((leg) => !leg.line.toLowerCase().includes('walk'))?.mode;
  if (mode === 'path') return 4;
  if (mode === 'ferry') return 30;
  if (mode === 'bus') return 12;
  if (mode === 'driving') return 20;
  return 15;
}

function upcomingDepartures(route: RouteCandidate, now: Date): { label: string; route: RouteCandidate }[] {
  const headway = routeHeadwayMinutes(route);
  const baseMinutes = clockMinutes(route.departureTime);
  // Round up to the next minute so an option that is already leaving this
  // minute is never presented as an upcoming departure.
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() > 0 ? 1 : 0);
  let nextMinutes = baseMinutes;
  while (nextMinutes < nowMinutes) nextMinutes += headway;

  return Array.from({ length: 4 }, (_, index) => {
    const departureMinutes = nextMinutes + index * headway;
    return {
      label: formatClock(departureMinutes),
      route: shiftRouteSchedule(route, departureMinutes - baseMinutes),
    };
  });
}

// Map from verdict state to color utility classes
const VERDICT_CLASSES: Record<VerdictState, { border: string; bg: string; text: string; dot: string }> = {
  comfortable: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  tight: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  reroute: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
};

export function DepartureTimeline({
  primaryRoute,
  planBRoute,
  selectedRoute,
  verdictState = 'comfortable',
  onSelectRoute,
}: DepartureTimelineProps) {
  // Live countdown state
  const [secondsUntilDeparture, setSecondsUntilDeparture] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [planningFromNow, setPlanningFromNow] = useState(false);

  useEffect(() => {
    const departureDate = parseTimeToday(selectedRoute.departureTime);

    function tick() {
      const now = new Date();
      setCurrentTime(now);
      const diff = Math.floor((departureDate.getTime() - now.getTime()) / 1000);
      setSecondsUntilDeparture(diff);
    }

    tick(); // run immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [selectedRoute.departureTime]);

  const { display: countdownDisplay, urgent, passed } = formatCountdown(secondsUntilDeparture);
  const verdictCls = VERDICT_CLASSES[verdictState];
  const scheduleAnchor = selectedRoute.id === primaryRoute.id
    ? primaryRoute
    : planBRoute?.id === selectedRoute.id
      ? planBRoute
      : primaryRoute;

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'path':
      case 'rail':
        return <Train className="h-4 w-4 text-zinc-900" />;
      case 'ferry':
        return <Ship className="h-4 w-4 text-zinc-900" />;
      case 'bus':
        return <Bus className="h-4 w-4 text-zinc-900" />;
      case 'driving':
        return <Car className="h-4 w-4 text-zinc-900" />;
      default:
        return <Footprints className="h-4 w-4 text-zinc-600" />;
    }
  };

  const getLegBarWidth = (leg: { durationMinutes: number }): number => {
    const totalDuration = selectedRoute.totalDurationMinutes;
    return Math.max(8, Math.round((leg.durationMinutes / totalDuration) * 100));
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col gap-5">
      
      {/* Header: title + route toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-700" />
            Departure Timeline
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Leg-by-leg schedule with allocated safety margins
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg text-xs">
          <button
            id="timeline-primary-btn"
            onClick={() => onSelectRoute(primaryRoute)}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              selectedRoute.id === primaryRoute.id
                ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Primary Option
          </button>
          {planBRoute && (
            <button
              id="timeline-planb-btn"
              onClick={() => onSelectRoute(planBRoute)}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                selectedRoute.id === planBRoute.id
                  ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Plan B Fallback
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPlanningFromNow((active) => !active)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${planningFromNow ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
        >
          <Timer className="h-3.5 w-3.5" />
          {planningFromNow ? 'Planning from now' : 'Depart now'}
        </button>
      </div>

      {planningFromNow && currentTime && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-blue-950">Upcoming {selectedRoute.name} departures</p>
            <p className="text-[10px] text-blue-700">Based on the selected route&apos;s typical {routeHeadwayMinutes(scheduleAnchor)}-minute headway. Current time: {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {upcomingDepartures(scheduleAnchor, currentTime).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => onSelectRoute(option.route)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${option.route.departureTime === selectedRoute.departureTime ? 'border-blue-700 bg-blue-700 text-white' : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-100'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === LIVE COUNTDOWN CLOCK (Phase 5.3) === */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${verdictCls.border} ${verdictCls.bg}`}>
        {/* Big countdown display */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-black tabular-nums tracking-tight ${verdictCls.text} ${
                urgent && !passed ? 'animate-pulse' : ''
              }`}
            >
              {passed ? '—' : countdownDisplay}
            </span>
            {!passed && (
              <span className="text-xs font-medium text-zinc-500">until departure</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Timer className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <span className="text-xs text-zinc-500">
              Leave by{' '}
              <span className="font-bold text-zinc-800">{formatTime12(selectedRoute.departureTime)}</span>
              {' '}· Arrive by{' '}
              <span className="font-bold text-zinc-800">{formatTime12(selectedRoute.arrivalTime)}</span>
            </span>
          </div>
        </div>

        {/* Live time + urgency badge */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="text-xs font-mono text-zinc-500 tabular-nums">
            {currentTime
              ? currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })
              : '—'}
          </div>
          {urgent && !passed && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Leave now
            </div>
          )}
          {passed && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-semibold text-zinc-500">
              Departed
            </div>
          )}
        </div>
      </div>

      {/* === VISUAL PROPORTIONAL TIMELINE BAR === */}
      <div>
        <div className="flex items-center gap-0.5 h-6 rounded-full overflow-hidden border border-zinc-200">
          {selectedRoute.legs.map((leg, i) => {
            const widthPct = getLegBarWidth(leg);
            const legColor = leg.lineColor ?? '#94a3b8';
            const isWalk = leg.line.toLowerCase().includes('walk');
            return (
              <div
                key={leg.id}
                className="h-full flex items-center justify-center text-[9px] font-bold text-white transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: isWalk ? '#e2e8f0' : legColor,
                  opacity: isWalk ? 0.6 : 1,
                }}
                title={`${leg.line} · ${leg.durationMinutes}m`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-zinc-400">
          <span>{formatTime12(selectedRoute.departureTime)}</span>
          <span className="text-center text-zinc-500 font-medium">{selectedRoute.totalDurationMinutes}m journey</span>
          <span>{formatTime12(selectedRoute.arrivalTime)}</span>
        </div>
      </div>

      {/* === METRICS STRIP === */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
        <div>
          <div className="text-[11px] text-zinc-500">Travel Time</div>
          <div className="text-base font-bold text-zinc-900">{selectedRoute.totalDurationMinutes}m</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Buffer Margin</div>
          <div className={`text-base font-bold ${verdictCls.text}`}>+{selectedRoute.bufferMinutes}m</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Reliability</div>
          <div className="text-base font-bold text-zinc-900">{selectedRoute.reliabilityRate}%</div>
        </div>
      </div>

      {/* === JOURNEY LEGS === */}
      <div className="space-y-3 relative before:absolute before:top-4 before:bottom-4 before:left-5 before:w-0.5 before:bg-zinc-100">
        {selectedRoute.legs.map((leg, idx) => {
          const hasDelay = (leg.delayMinutes ?? 0) > 0 && (leg.delayMinutes ?? 0) < 999;
          const isSuspended = (leg.delayMinutes ?? 0) >= 999;

          return (
            <div key={leg.id} className="relative flex items-start gap-3.5">
              {/* Node icon */}
              <div
                className="relative z-10 shrink-0 w-10 h-10 rounded-xl border bg-white flex items-center justify-center shadow-sm"
                style={{
                  borderColor: isSuspended ? '#fca5a5' : hasDelay ? '#fcd34d' : '#e4e4e7',
                }}
              >
                {getModeIcon(leg.mode)}
              </div>

              {/* Leg content */}
              <div
                className="flex-1 min-w-0 p-3 rounded-xl border transition-all"
                style={{
                  borderColor: isSuspended ? '#fca5a5' : hasDelay ? '#fde68a' : '#f4f4f5',
                  backgroundColor: isSuspended ? '#fff1f2' : hasDelay ? '#fffbeb' : '#fafafa',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {leg.lineColor && (
                      <span
                        className="shrink-0 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: leg.lineColor }}
                      />
                    )}
                    <span className="text-xs font-bold text-zinc-900 truncate">{leg.line}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-700 shrink-0 font-semibold tabular-nums">
                    {formatTime12(leg.departureTime)} → {formatTime12(leg.arrivalTime)}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 mt-1 flex items-center gap-1.5 truncate">
                  <span className="truncate">{leg.fromName}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                  <span className="truncate">{leg.toName}</span>
                </div>

                <div className="flex items-center justify-between mt-1.5">
                  {leg.statusText && (
                    <div className="text-[11px] flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSuspended ? 'bg-red-500' : hasDelay ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span className={isSuspended ? 'text-red-600 font-medium' : hasDelay ? 'text-amber-600' : 'text-zinc-500'}>
                        {leg.statusText}
                      </span>
                    </div>
                  )}
                  <span className="text-[11px] text-zinc-400 ml-auto tabular-nums">
                    {leg.durationMinutes}m
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-zinc-700" />
          <span>~90% on-time confidence buffer</span>
        </span>
        <span className="font-mono text-zinc-800 font-semibold">
          Target: {formatTime12(selectedRoute.arrivalTime)}
        </span>
      </div>
    </div>
  );
}
