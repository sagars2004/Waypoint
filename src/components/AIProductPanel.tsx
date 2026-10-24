'use client';

import React from 'react';
import { BrainCircuit, CalendarDays, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

const currentCapabilities = [
  {
    icon: ShieldCheck,
    title: 'Grounded route reasoning',
    text: 'The route engine combines schedules, live/replay feed status, transfers, delays, and safety buffers. AI explains the decision using only that evidence.',
  },
  {
    icon: MessageCircle,
    title: 'Conversational commute copilot',
    text: 'Ask why a route changed, whether you can make a stop, or which fallback is safer. Responses include the feed and route metrics behind the answer.',
  },
  {
    icon: BrainCircuit,
    title: 'Multimodal awareness',
    text: 'Each itinerary is represented as ordered legs, so the assistant can reason about PATH → subway, LIRR → subway, bus connections, and transfer risk.',
  },
];

const nextFeatures = [
  { icon: CalendarDays, title: 'Frequent routes calendar', text: 'Save weekday routines, departure windows, and recurring arrival targets for one-tap planning.' },
  { icon: Sparkles, title: 'Proactive daily brief', text: 'Before a commute, summarize changes, recommend when to leave, and notify only when the plan materially changes.' },
  { icon: MessageCircle, title: 'Personalized stop suggestions', text: 'Recommend coffee, food, errands, or accessibility-friendly stops only when the available buffer supports them.' },
];

export function AIProductPanel() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs" aria-labelledby="ai-product-title">
      <div className="flex flex-col gap-1 border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 id="ai-product-title" className="text-sm font-bold text-zinc-900">How AI powers Waypoint</h2>
            <p className="text-xs text-zinc-500">An explainable commute copilot, not a black-box route guesser.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {currentCapabilities.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <Icon className="h-4 w-4 text-zinc-700" />
            <h3 className="mt-2 text-xs font-bold text-zinc-900">{title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Next productivity features</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {nextFeatures.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-2">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-700" />
              <div>
                <p className="text-[11px] font-semibold text-blue-950">{title}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-blue-800">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
