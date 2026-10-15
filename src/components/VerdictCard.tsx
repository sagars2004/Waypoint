'use client';

import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Info
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

  const stateConfig = {
    comfortable: {
      badgeBg: 'bg-emerald-500/15',
      badgeBorder: 'border-emerald-500/30',
      badgeText: 'text-emerald-400',
      heroBorder: 'border-emerald-500/30',
      glow: 'glow-comfortable',
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-400" />,
      label: 'COMFORTABLE',
      sublabel: 'Low risk of delays along your corridor',
    },
    tight: {
      badgeBg: 'bg-amber-500/15',
      badgeBorder: 'border-amber-500/30',
      badgeText: 'text-amber-400',
      heroBorder: 'border-amber-500/30',
      glow: 'glow-tight',
      icon: <AlertTriangle className="h-6 w-6 text-amber-400" />,
      label: 'TIGHT BUT DOABLE',
      sublabel: 'Minor congestion / reduced transfer margins',
    },
    reroute: {
      badgeBg: 'bg-rose-500/15',
      badgeBorder: 'border-rose-500/30',
      badgeText: 'text-rose-400',
      heroBorder: 'border-rose-500/30',
      glow: 'glow-reroute',
      icon: <AlertOctagon className="h-6 w-6 text-rose-400" />,
      label: 'REROUTE NOW',
      sublabel: 'Severe delay or suspension on primary line',
    },
  }[verdict.state];

  const confidenceBadge = {
    high: { text: 'High Confidence', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    medium: { text: 'Medium Confidence', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    low: { text: 'Low Confidence (Stale feed)', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  }[verdict.confidence];

  return (
    <div className={`relative overflow-hidden rounded-2xl glass-panel p-6 border ${stateConfig.heroBorder} ${stateConfig.glow} transition-all duration-300`}>
      {/* Background ambient lighting */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      
      {/* Header Row: Verdict Status & Confidence */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${stateConfig.badgeBg} border ${stateConfig.badgeBorder}`}>
            {stateConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-extrabold tracking-wide ${stateConfig.badgeText}`}>
                {stateConfig.label}
              </span>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${confidenceBadge.color}`}>
                {confidenceBadge.text}
              </span>
            </div>
            <p className="text-xs text-slate-400">{stateConfig.sublabel}</p>
          </div>
        </div>

        {/* Live freshness badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/10 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{verdict.freshnessTimestamp}</span>
        </div>
      </div>

      {/* Main Leave-By Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Column: Big Departure Time */}
        <div className="md:col-span-7 flex flex-col justify-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            Recommended Departure
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              {verdict.leaveByTime}
              <span className="text-xl sm:text-2xl font-bold text-slate-400 ml-1.5">AM</span>
            </h2>
            <div className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold text-sm">
              in {verdict.countdownMinutes} mins
            </div>
          </div>

          {/* Primary Route Name and Summary */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-200">
                {verdict.primaryRoute.name}
              </div>
              <div className="text-xs text-slate-400">
                {verdict.primaryRoute.summary} • {verdict.primaryRoute.totalDurationMinutes} min trip
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-emerald-400 block">
                {verdict.primaryRoute.bufferMinutes}m buffer
              </span>
              <span className="text-[11px] text-slate-400">
                ${verdict.primaryRoute.estimatedCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Rationale Box */}
        <div className="md:col-span-5 bg-slate-900/90 rounded-xl p-4 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Agent Rationale (Nemotron)
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              &ldquo;{verdict.reason}&rdquo;
            </p>
          </div>

          {/* Feed stats */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Historical Reliability:</span>
            <span className="font-semibold text-slate-200">
              {verdict.primaryRoute.reliabilityRate}% on-time
            </span>
          </div>
        </div>
      </div>

      {/* Plan B Ready Section */}
      {verdict.planBRoute && (
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-3.5 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Plan B Alternative
                  </span>
                  <span className="text-xs text-slate-400">• Ready if primary degrades</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {verdict.planBRoute.name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-300">
              <div>
                <span className="text-slate-400">Depart: </span>
                <span className="font-medium text-white">{verdict.planBRoute.departureTime} AM</span>
              </div>
              <div>
                <span className="text-slate-400">Duration: </span>
                <span className="font-medium text-white">{verdict.planBRoute.totalDurationMinutes} min</span>
              </div>
              {onSelectRoute && (
                <button
                  onClick={() => onSelectRoute(verdict.planBRoute!)}
                  className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-medium transition flex items-center gap-1"
                >
                  <span>View</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts Banner if present */}
      {verdict.alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {verdict.alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 mr-1.5">{alert.title}:</span>
                <span>{alert.description}</span>
                <span className="text-amber-400/70 ml-2 font-mono">({alert.timestamp})</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
