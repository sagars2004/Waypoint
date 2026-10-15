'use client';

import React from 'react';
import { 
  Train, 
  Ship, 
  Bus, 
  Car, 
  Footprints, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  TrendingUp,
  Percent
} from 'lucide-react';
import { RouteCandidate, RouteLeg } from '@/types/commute';

interface DepartureTimelineProps {
  primaryRoute: RouteCandidate;
  planBRoute?: RouteCandidate;
  selectedRoute: RouteCandidate;
  onSelectRoute: (route: RouteCandidate) => void;
}

export function DepartureTimeline({
  primaryRoute,
  planBRoute,
  selectedRoute,
  onSelectRoute,
}: DepartureTimelineProps) {
  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'path':
      case 'rail':
        return <Train className="h-4 w-4" />;
      case 'ferry':
        return <Ship className="h-4 w-4" />;
      case 'bus':
        return <Bus className="h-4 w-4" />;
      case 'driving':
        return <Car className="h-4 w-4" />;
      default:
        return <Footprints className="h-4 w-4" />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'path':
        return 'text-sky-400 bg-sky-500/15 border-sky-500/30';
      case 'rail':
        return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
      case 'ferry':
        return 'text-teal-400 bg-teal-500/15 border-teal-500/30';
      case 'bus':
        return 'text-purple-400 bg-purple-500/15 border-purple-500/30';
      case 'driving':
        return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
      default:
        return 'text-slate-400 bg-slate-500/15 border-slate-500/30';
    }
  };

  return (
    <div className="rounded-2xl glass-panel p-5 border border-white/10 flex flex-col justify-between">
      <div>
        {/* Header and Route Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Departure Timeline & Journey Risk
            </h3>
            <p className="text-xs text-slate-400">
              Leg-by-leg breakdown and safety buffer allocation
            </p>
          </div>

          {/* Route toggle buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => onSelectRoute(primaryRoute)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedRoute.id === primaryRoute.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Primary Option
            </button>
            {planBRoute && (
              <button
                onClick={() => onSelectRoute(planBRoute)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  selectedRoute.id === planBRoute.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Plan B Fallback
              </button>
            )}
          </div>
        </div>

        {/* Selected Route Highlights */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/60 rounded-xl border border-white/5 mb-5 text-center">
          <div>
            <div className="text-[11px] text-slate-400">Travel Time</div>
            <div className="text-base font-bold text-white">
              {selectedRoute.totalDurationMinutes} mins
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Buffer Window</div>
            <div className="text-base font-bold text-emerald-400">
              +{selectedRoute.bufferMinutes} mins
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Reliability Rate</div>
            <div className="text-base font-bold text-cyan-400 flex items-center justify-center gap-0.5">
              <span>{selectedRoute.reliabilityRate}%</span>
            </div>
          </div>
        </div>

        {/* Journey Legs Steps */}
        <div className="space-y-3 relative before:absolute before:top-4 before:bottom-4 before:left-5 before:w-0.5 before:bg-white/10">
          {selectedRoute.legs.map((leg, index) => {
            const isLast = index === selectedRoute.legs.length - 1;
            return (
              <div key={leg.id} className="relative flex items-start gap-3.5 group">
                {/* Node icon */}
                <div
                  className={`relative z-10 shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${getModeColor(
                    leg.mode
                  )}`}
                >
                  {getModeIcon(leg.mode)}
                </div>

                {/* Leg content */}
                <div className="flex-1 min-w-0 bg-slate-900/40 p-3 rounded-xl border border-white/5 hover:border-white/10 transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {leg.line}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 shrink-0 font-semibold">
                      {leg.departureTime} → {leg.arrivalTime}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5 truncate">
                    <span>{leg.fromName}</span>
                    <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                    <span>{leg.toName}</span>
                  </div>

                  {leg.statusText && (
                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
                      <span>{leg.statusText}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Buffer Explanation footer */}
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Calculated for 90% arrival probability
        </span>
        <span className="font-mono text-slate-300 font-semibold">
          Target: 09:00 AM
        </span>
      </div>
    </div>
  );
}
