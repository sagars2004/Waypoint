'use client';

import React from 'react';
import { 
  Navigation, 
  Clock, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Verdict, RouteCandidate } from '@/types/commute';

interface VerdictCardProps {
  verdict: Verdict;
  onSelectRoute?: (route: RouteCandidate) => void;
}

export function VerdictCard({ verdict, onSelectRoute }: VerdictCardProps) {
  const isComfortable = verdict.state === 'comfortable';
  const isTight = verdict.state === 'tight';
  const isReroute = verdict.state === 'reroute';

  const badgeConfig = {
    comfortable: {
      dot: 'bg-emerald-500',
      label: 'Comfortable',
      container: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    },
    tight: {
      dot: 'bg-amber-500',
      label: 'Tight Margin',
      container: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    reroute: {
      dot: 'bg-red-500',
      label: 'Reroute Recommended',
      container: 'bg-red-50 text-red-800 border-red-200',
    },
  }[verdict.state];

  // Extract first and last leg names for the Concourse route graphic
  const firstLeg = verdict.primaryRoute.legs[0];
  const lastLeg = verdict.primaryRoute.legs[verdict.primaryRoute.legs.length - 1];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
      {/* Card Header matching Concourse */}
      <div className="flex flex-row items-center justify-between pb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 border border-zinc-200">
            <Navigation className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {verdict.primaryRoute.name}
            </h2>
            <p className="text-xs text-zinc-500">
              {verdict.primaryRoute.summary}
            </p>
          </div>
        </div>

        {/* Minimalist status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badgeConfig.container}`}>
          <span className={`h-2 w-2 rounded-full ${badgeConfig.dot}`} />
          <span>{badgeConfig.label}</span>
        </div>
      </div>

      {/* Concourse Route Graphic: Origin • ——— Leave By / Duration ——— • Destination */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          {/* Origin */}
          <div className="flex shrink-0 flex-col items-center gap-1 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white shadow-2xs">
              DEP
            </div>
            <p className="text-xs font-semibold text-zinc-900 max-w-[90px] truncate" title={firstLeg?.fromName}>
              {firstLeg?.fromName || 'Origin'}
            </p>
            <p className="text-xs font-bold text-zinc-900">{verdict.leaveByTime} AM</p>
            <p className="text-[10px] text-zinc-500">Recommended</p>
          </div>

          {/* Connecting line with travel time & countdown */}
          <div className="relative flex flex-1 items-center px-2">
            <div className="h-0.5 w-full rounded-full bg-zinc-200" />
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-2xs">
              <Clock className="h-3 w-3 text-zinc-600" />
              <span className="text-xs font-semibold text-zinc-800">
                {verdict.primaryRoute.totalDurationMinutes}m transit
              </span>
              <span className="text-zinc-300">•</span>
              <span className="text-xs text-zinc-500">
                leave in {verdict.countdownMinutes}m
              </span>
            </div>
          </div>

          {/* Destination */}
          <div className="flex shrink-0 flex-col items-center gap-1 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-900 border border-zinc-200 shadow-2xs">
              ARR
            </div>
            <p className="text-xs font-semibold text-zinc-900 max-w-[90px] truncate" title={lastLeg?.toName}>
              {lastLeg?.toName || 'Destination'}
            </p>
            <p className="text-xs font-bold text-zinc-900">09:00 AM</p>
            <p className="text-[10px] text-zinc-500">Target</p>
          </div>
        </div>
      </div>

      {/* Metrics Row (matching Concourse FlightStatus 4-column grid) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-1">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Leave-By Time
          </p>
          <p className="text-lg font-bold text-zinc-900">
            {verdict.leaveByTime} <span className="text-xs font-normal text-zinc-500">AM</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Safety Buffer
          </p>
          <p className="text-lg font-bold text-zinc-900">
            +{verdict.primaryRoute.bufferMinutes} <span className="text-xs font-normal text-zinc-500">mins</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Historical Reliability
          </p>
          <p className="text-lg font-bold text-zinc-900">
            {verdict.primaryRoute.reliabilityRate}% <span className="text-xs font-normal text-zinc-500">on-time</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Estimated Fare
          </p>
          <p className="text-lg font-bold text-zinc-900">
            ${verdict.primaryRoute.estimatedCost.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Agent Rationale Box */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-1.5">
          <Sparkles className="h-3.5 w-3.5 text-zinc-700" />
          Departure Verdict Rationale
        </div>
        <p className="text-sm text-zinc-700 leading-relaxed font-normal">
          &ldquo;{verdict.reason}&rdquo;
        </p>
      </div>

      {/* Plan B Alternative Box */}
      {verdict.planBRoute && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Plan B Alternative
              </div>
              <div className="text-sm font-semibold text-zinc-900">
                {verdict.planBRoute.name}
              </div>
              <div className="text-xs text-zinc-500">
                {verdict.planBRoute.summary} • {verdict.planBRoute.totalDurationMinutes}m transit
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-zinc-500">Depart: </span>
              <span className="font-semibold text-zinc-900">{verdict.planBRoute.departureTime} AM</span>
            </div>
            {onSelectRoute && (
              <button
                onClick={() => onSelectRoute(verdict.planBRoute!)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 font-medium transition flex items-center gap-1"
              >
                <span>View Route</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Alerts Banner if any */}
      {verdict.alerts.length > 0 && (
        <div className="space-y-2">
          {verdict.alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900"
            >
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-950 mr-1.5">{alert.title}:</span>
                <span>{alert.description}</span>
                <span className="text-amber-700/80 ml-2 font-mono">({alert.timestamp})</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
