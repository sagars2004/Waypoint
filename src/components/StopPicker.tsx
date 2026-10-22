'use client';

import React, { useMemo, useState } from 'react';
import { Bus, Check, MapPin, Search, Ship, Train } from 'lucide-react';
import { TransitStop, TRANSIT_STOPS } from '@/data/transitStops';
import { TransitMode } from '@/types/commute';

type StopValue = { name: string; coordinates?: [number, number]; stopId?: string; agency?: string; mode?: TransitMode };

interface StopPickerProps {
  label: string;
  value: StopValue;
  onChange: (stop: TransitStop) => void;
}

const FILTERS: { value: 'all' | TransitMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'path', label: 'PATH' },
  { value: 'rail', label: 'Rail / Subway' },
  { value: 'bus', label: 'Bus' },
  { value: 'ferry', label: 'Ferry' },
];

function modeIcon(mode: TransitMode) {
  if (mode === 'bus') return <Bus className="h-3.5 w-3.5" />;
  if (mode === 'ferry') return <Ship className="h-3.5 w-3.5" />;
  return <Train className="h-3.5 w-3.5" />;
}

export function StopPicker({ label, value, onChange }: StopPickerProps) {
  const [query, setQuery] = useState(value.name);
  const [filter, setFilter] = useState<'all' | TransitMode>('all');
  const [isOpen, setIsOpen] = useState(false);

  const filteredStops = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return TRANSIT_STOPS.filter((stop) => {
      const matchesMode = filter === 'all' || stop.mode === filter;
      const haystack = [stop.name, stop.agency, ...stop.aliases].join(' ').toLowerCase();
      return matchesMode && (!normalized || haystack.includes(normalized));
    }).slice(0, 8);
  }, [filter, query]);

  const selectStop = (stop: TransitStop) => {
    setQuery(stop.name);
    setIsOpen(false);
    onChange(stop);
  };

  return (
    <div className="relative">
      <label className="text-zinc-600 font-semibold block mb-1">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
        <input
          type="search"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          placeholder="Search a station, stop, or agency"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${filter === item.value ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredStops.map((stop) => {
              const selected = value.stopId === stop.id;
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => selectStop(stop)}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">{modeIcon(stop.mode)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-zinc-900">{stop.name}</span>
                    <span className="block truncate text-[10px] text-zinc-500">{stop.agency} · {stop.coordinates[1].toFixed(4)}, {stop.coordinates[0].toFixed(4)}</span>
                  </span>
                  {selected ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <MapPin className="h-3.5 w-3.5 text-zinc-300" />}
                </button>
              );
            })}
            {filteredStops.length === 0 && <p className="px-2 py-3 text-[11px] text-zinc-500">No matching stops. Try a station, agency, or mode.</p>}
          </div>
        </div>
      )}
      {isOpen && <button type="button" aria-label="Close stop search" className="fixed inset-0 z-20 cursor-default" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
