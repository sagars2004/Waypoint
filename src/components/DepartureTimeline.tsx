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
  ShieldCheck 
} from 'lucide-react';
import { RouteCandidate } from '@/types/commute';

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

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header and Route Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-700" />
              Departure Timeline & Buffer Allocation
            </h3>
            <p className="text-xs text-zinc-500">
              Leg-by-leg schedule and allocated safety margins
            </p>
          </div>

          {/* Minimalist route toggle buttons */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg text-xs">
            <button
              onClick={() => onSelectRoute(primaryRoute)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedRoute.id === primaryRoute.id
                  ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Primary Option
            </button>
            {planBRoute && (
              <button
                onClick={() => onSelectRoute(planBRoute)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedRoute.id === planBRoute.id
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Plan B Fallback
              </button>
            )}
          </div>
        </div>

        {/* Selected Route Summary Metrics */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200 mb-5 text-center">
          <div>
            <div className="text-[11px] text-zinc-500">Travel Time</div>
            <div className="text-base font-bold text-zinc-900">
              {selectedRoute.totalDurationMinutes} mins
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Buffer Margin</div>
            <div className="text-base font-bold text-zinc-900">
              +{selectedRoute.bufferMinutes} mins
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Line Reliability</div>
            <div className="text-base font-bold text-zinc-900">
              {selectedRoute.reliabilityRate}%
            </div>
          </div>
        </div>

        {/* Journey Legs Steps */}
        <div className="space-y-3 relative before:absolute before:top-4 before:bottom-4 before:left-5 before:w-0.5 before:bg-zinc-200">
          {selectedRoute.legs.map((leg) => {
            return (
              <div key={leg.id} className="relative flex items-start gap-3.5">
                {/* Node icon */}
                <div className="relative z-10 shrink-0 w-10 h-10 rounded-xl border border-zinc-200 bg-white flex items-center justify-center shadow-2xs">
                  {getModeIcon(leg.mode)}
                </div>

                {/* Leg content */}
                <div className="flex-1 min-w-0 bg-zinc-50/60 p-3 rounded-xl border border-zinc-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-900 truncate">
                      {leg.line}
                    </span>
                    <span className="text-xs font-mono text-zinc-700 shrink-0 font-semibold">
                      {leg.departureTime} → {leg.arrivalTime}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-600 mt-1 flex items-center gap-1.5 truncate">
                    <span>{leg.fromName}</span>
                    <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                    <span>{leg.toName}</span>
                  </div>

                  {leg.statusText && (
                    <div className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
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
      <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-zinc-700" />
          Allocated for ~90% on-time likelihood
        </span>
        <span className="font-mono text-zinc-800 font-semibold">
          Target: 09:00 AM
        </span>
      </div>
    </div>
  );
}
