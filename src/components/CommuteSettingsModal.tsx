'use client';

import React, { useState } from 'react';
import { X, Check, SlidersHorizontal, Train, Ship, Bus, Car, Clock, ShieldAlert } from 'lucide-react';
import { CommuteProfile, TransitMode } from '@/types/commute';

interface CommuteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CommuteProfile;
  onSaveProfile: (updated: CommuteProfile) => void;
}

export function CommuteSettingsModal({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}: CommuteSettingsModalProps) {
  const [formData, setFormData] = useState<CommuteProfile>(profile);

  if (!isOpen) return null;

  const toggleMode = (mode: TransitMode) => {
    const current = formData.acceptedModes;
    const exists = current.includes(mode);
    const updated = exists
      ? current.filter((m) => m !== mode)
      : [...current, mode];
    
    // Keep at least one mode
    if (updated.length > 0) {
      setFormData({ ...formData, acceptedModes: updated });
    }
  };

  const handleSave = () => {
    onSaveProfile(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl glass-panel bg-slate-950 p-6 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-white">Commute Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 py-4 text-xs">
          {/* Origin & Destination */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Origin Station</label>
            <input
              type="text"
              value={formData.origin.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  origin: { ...formData.origin, name: e.target.value },
                })
              }
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Destination</label>
            <input
              type="text"
              value={formData.destination.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  destination: { ...formData.destination, name: e.target.value },
                })
              }
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Arrive-by time */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              Target Arrive-By Time
            </label>
            <input
              type="time"
              value={formData.arriveByTime}
              onChange={(e) =>
                setFormData({ ...formData, arriveByTime: e.target.value })
              }
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Accepted Modes */}
          <div>
            <label className="text-slate-400 font-semibold block mb-2">Accepted Modes</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { mode: 'path' as TransitMode, label: 'PATH Train', icon: <Train className="h-3.5 w-3.5" /> },
                { mode: 'rail' as TransitMode, label: 'NJ Transit Rail', icon: <Train className="h-3.5 w-3.5" /> },
                { mode: 'ferry' as TransitMode, label: 'NY Waterway Ferry', icon: <Ship className="h-3.5 w-3.5" /> },
                { mode: 'bus' as TransitMode, label: 'Transit Bus', icon: <Bus className="h-3.5 w-3.5" /> },
                { mode: 'driving' as TransitMode, label: 'Driving / Tunnel', icon: <Car className="h-3.5 w-3.5" /> },
              ].map((item) => {
                const active = formData.acceptedModes.includes(item.mode);
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => toggleMode(item.mode)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Risk Tolerance */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
              Risk Tolerance Margin
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['conservative', 'balanced', 'aggressive'] as const).map((level) => {
                const active = formData.preferences.riskTolerance === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, riskTolerance: level },
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-xl border capitalize font-medium transition ${
                      active
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 font-medium text-xs transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 transition flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
