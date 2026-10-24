'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Clock3 } from 'lucide-react';
import { formatTime12 } from '@/lib/time';

interface TimePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function buildTimeOptions() {
  return Array.from({ length: 96 }, (_, index) => {
    const totalMinutes = index * 15;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  });
}

export function TimePicker({ id, label, value, onChange, placeholder }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const options = useMemo(() => buildTimeOptions(), []);

  const selectTime = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="text-xs font-semibold text-zinc-600">{label}</label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="mt-1 flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-900 transition hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <span className={value ? 'font-medium text-zinc-900' : 'text-zinc-400'}>
          {value ? formatTime12(value) : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label={`Close ${label.toLowerCase()} picker`}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              data-testid={`${id}-current-time`}
              onClick={() => selectTime(currentTimeValue())}
              className="flex w-full items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2 text-left text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
            >
              <Clock3 className="h-3.5 w-3.5" />
              Use current time
              <span className="ml-auto text-[10px] font-normal text-blue-700">{formatTime12(currentTimeValue())}</span>
            </button>
            <div className="mt-2 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <span>Choose a time</span>
              <span>15-minute intervals</span>
            </div>
            <div role="listbox" aria-label={`${label} options`} className="mt-1 grid max-h-52 grid-cols-2 gap-1 overflow-y-auto pr-1">
              {options.map((option) => {
                const selected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectTime(option)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${selected ? 'bg-zinc-900 font-semibold text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
                  >
                    {formatTime12(option)}
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      <p className="mt-1 text-[11px] text-zinc-500">{value ? formatTime12(value) : placeholder}</p>
    </div>
  );
}
