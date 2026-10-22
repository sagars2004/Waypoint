import React from 'react';
import { Navigation } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white py-6 mt-10">
      <div className="flex w-full items-center justify-center px-4 text-xs text-zinc-500 sm:px-6">
        <div className="flex items-center gap-2">
          <Navigation className="h-3.5 w-3.5 text-zinc-700" />
          <span>© 2026 Waypoint. All Rights Reserved. Built for the Nebius x NVIDIA Hackathon.</span>
        </div>
      </div>
    </footer>
  );
}
