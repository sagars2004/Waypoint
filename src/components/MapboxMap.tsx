'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { RouteCandidate, VerdictState } from '@/types/commute';

// Mapbox GL is loaded via dynamic import to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxGLType = typeof import('mapbox-gl');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxPopup = any;

interface MapboxMapProps {
  primaryRoute: RouteCandidate;
  planBRoute?: RouteCandidate;
  selectedRoute: RouteCandidate;
  verdictState: VerdictState;
  originName: string;
  destinationName: string;
}

// --- Static GeoJSON Corridors ---
// Real-world polyline coordinates for the Hoboken↔Midtown corridor
const ROUTE_GEOJSON: Record<string, [number, number][]> = {
  // PATH HOB→33rd: Hoboken Terminal → Journal Square → 33rd St
  'candidate-path-33': [
    [-74.0279, 40.7354], // Hoboken Terminal
    [-74.0625, 40.7268], // Journal Square
    [-74.0432, 40.7308], // Grove St (pass-through)
    [-74.0016, 40.7505], // 14th St (midpoint underwater)
    [-73.9887, 40.7484], // 9th St
    [-73.9890, 40.7502], // 14th St Station
    [-73.9872, 40.7484], // 23rd St
    [-73.9884, 40.7492], // 28th St
    [-73.9879, 40.7504], // 33rd St Station
    [-73.9877, 40.7517], // Herald Sq (walk)
  ],
  // NY Waterway Ferry: Hoboken 14th St Pier → W 39th St
  'candidate-ferry-midtown': [
    [-74.0279, 40.7354], // Hoboken Terminal
    [-74.0241, 40.7440], // Walk to 14th St Pier
    [-74.0148, 40.7478], // Hudson River mid-point
    [-74.0042, 40.7573], // W 39th St Ferry Terminal
    [-73.9939, 40.7555], // Shuttle to Herald Sq
    [-73.9877, 40.7517], // Herald Sq
  ],
  // NJT Rail: Hoboken → Secaucus → NY Penn
  'candidate-njt-rail': [
    [-74.0279, 40.7354], // Hoboken Terminal
    [-74.0626, 40.7601], // Weehawken Pass
    [-74.0742, 40.7614], // Secaucus Junction
    [-74.0020, 40.7496], // NJ Transit Rail Tunnel (under Hudson)
    [-73.9931, 40.7505], // NY Penn Station
    [-73.9877, 40.7517], // Herald Sq (walk)
  ],
  // NJT 126 Bus: Hoboken Washington St → Lincoln Tunnel → PABT → Herald Sq
  'candidate-bus-126': [
    [-74.0279, 40.7354], // Hoboken Terminal
    [-74.0255, 40.7419], // Washington & 8th St
    [-74.0202, 40.7629], // Lincoln Tunnel approach
    [-74.0033, 40.7578], // Lincoln Tunnel exit
    [-73.9990, 40.7564], // 8th Ave
    [-73.9934, 40.7536], // Port Authority Bus Terminal
    [-73.9877, 40.7517], // Herald Sq
  ],
  // Driving Lincoln Tunnel: Hoboken → 34th St
  'candidate-driving-lincoln': [
    [-74.0279, 40.7354], // Hoboken
    [-74.0222, 40.7498], // Route 139 approach
    [-74.0150, 40.7620], // Lincoln Tunnel entrance
    [-74.0033, 40.7578], // Lincoln Tunnel exit
    [-73.9900, 40.7540], // 34th St approach
    [-73.9877, 40.7517], // Herald Sq
  ],
  // JC PATH to WTC
  'candidate-path-wtc': [
    [-74.0330, 40.7176], // Exchange Place
    [-74.0252, 40.7127], // Grove St PATH
    [-74.0167, 40.7141], // Journal Square approach (WTC line)
    [-74.0122, 40.7098], // Under Hudson
    [-74.0118, 40.7124], // WTC approaches
    [-74.0139, 40.7127], // World Trade Center
  ],
  // JC Ferry: Paulus Hook → Brookfield Place
  'candidate-ferry-bpc': [
    [-74.0330, 40.7176], // Exchange Place (walk to pier)
    [-74.0340, 40.7152], // Paulus Hook Pier
    [-74.0235, 40.7150], // Hudson mid-river
    [-74.0157, 40.7148], // Brookfield Place Terminal
    [-74.0140, 40.7133], // Financial District
  ],
};

// Key stations for pin rendering
const STATIONS = {
  // Hoboken corridor
  hobokenTerminal: { coords: [-74.0279, 40.7354] as [number, number], label: 'Hoboken Terminal' },
  herald34th: { coords: [-73.9877, 40.7517] as [number, number], label: 'Herald Sq / 34th St' },
  path33rd: { coords: [-73.9879, 40.7504] as [number, number], label: '33rd St PATH' },
  ferryW39th: { coords: [-74.0042, 40.7573] as [number, number], label: 'W 39th St Ferry' },
  nypenn: { coords: [-73.9931, 40.7505] as [number, number], label: 'NY Penn Station' },
  pabt: { coords: [-73.9934, 40.7536] as [number, number], label: 'Port Authority' },
  // JC corridor
  exchangePlace: { coords: [-74.0330, 40.7176] as [number, number], label: 'Exchange Place' },
  wtc: { coords: [-74.0139, 40.7127] as [number, number], label: 'World Trade Center' },
  paulusHook: { coords: [-74.0340, 40.7152] as [number, number], label: 'Paulus Hook' },
};

// Color coding by verdict state
const VERDICT_GLOW: Record<VerdictState, string> = {
  comfortable: '#10b981', // emerald
  tight: '#f59e0b',       // amber
  reroute: '#ef4444',     // red
};

const ROUTE_COLORS: Record<string, string> = {
  path: '#0284c7',
  rail: '#e11d48',
  ferry: '#0d9488',
  bus: '#8b5cf6',
  driving: '#f97316',
};

function getRouteColor(route: RouteCandidate): string {
  const primaryLeg = route.legs.find((l) => !l.line.toLowerCase().includes('walk'));
  return primaryLeg?.lineColor ?? ROUTE_COLORS[primaryLeg?.mode ?? 'bus'] ?? '#64748b';
}

function getCenterForRoutes(primaryId: string): { center: [number, number]; zoom: number } {
  // JC corridor center
  if (primaryId.includes('wtc') || primaryId.includes('bpc')) {
    return { center: [-74.025, 40.725], zoom: 12.5 };
  }
  // Hoboken↔Midtown corridor center
  return { center: [-74.018, 40.742], zoom: 11.8 };
}

export function MapboxMap({
  primaryRoute,
  planBRoute,
  selectedRoute,
  verdictState,
  originName,
  destinationName,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance>(null);
  const popupRef = useRef<MapboxPopup>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // ResizeObserver to handle bento-grid resize correctly (Phase 5 Step 5.2)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Trigger map resize when container dimensions change
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.resize();
    }
  }, [dimensions, mapLoaded]);

  // Initialize Mapbox GL map
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return;
    }
    if (!containerRef.current) return;
    if (mapRef.current) return; // already initialized

    let mapboxgl: MapboxGLType;
    let destroyed = false;

    async function initMap() {
      try {
        mapboxgl = await import('mapbox-gl');
        if (destroyed) return;

        // @ts-expect-error — mapbox-gl types
        mapboxgl.accessToken = token;

        // Import CSS on first load
        await import('mapbox-gl/dist/mapbox-gl.css');

        const { center, zoom } = getCenterForRoutes(primaryRoute.id);

        const map: MapInstance = new mapboxgl.Map({
          container: containerRef.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center,
          zoom,
          attributionControl: false,
          logoPosition: 'bottom-right',
        });

        mapRef.current = map;

        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          if (destroyed) return;
          setMapLoaded(true);
          renderRoutes(map, mapboxgl, primaryRoute, planBRoute, selectedRoute, verdictState);
          renderStations(map, mapboxgl, primaryRoute, planBRoute, originName, destinationName);
        });

        map.on('error', (e: Error) => {
          console.error('Mapbox error:', e);
          setMapError('map-error');
        });
      } catch (e) {
        console.error('Failed to initialize Mapbox:', e);
        if (!destroyed) setMapError('load-error');
      }
    }

    initMap();

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update routes when primary/planB/selected/verdict changes
  const updateRoutes = useCallback(async () => {
    if (!mapRef.current || !mapLoaded) return;
    const mapboxgl = await import('mapbox-gl');
    const map = mapRef.current;

    // Remove existing layers/sources
    ['primary-route', 'planb-route', 'primary-route-outline', 'planb-route-outline'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    ['primary-route-src', 'planb-route-src'].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
    // Remove station layers
    ['origin-pin', 'destination-pin', 'transfer-pins', 'origin-label', 'destination-label', 'transfer-labels', 'vehicle-dot'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    ['station-origin-src', 'station-dest-src', 'station-transfers-src', 'vehicle-src'].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });

    renderRoutes(map, mapboxgl, primaryRoute, planBRoute, selectedRoute, verdictState);
    renderStations(map, mapboxgl, primaryRoute, planBRoute, originName, destinationName);
  }, [mapLoaded, primaryRoute, planBRoute, selectedRoute, verdictState, originName, destinationName]);

  useEffect(() => {
    updateRoutes();
  }, [updateRoutes]);

  // Error/fallback state — show SVG if no token or map failed
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN || mapError === 'no-token') {
    return <FallbackMap primaryRoute={primaryRoute} planBRoute={planBRoute} selectedRoute={selectedRoute} originName={originName} destinationName={destinationName} verdictState={verdictState} dimensions={dimensions} containerRef={containerRef} />;
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[320px] rounded-2xl overflow-hidden border border-zinc-200 shadow-xs">
      {/* The Mapbox GL canvas renders here */}
      <div id="mapbox-gl-canvas" className="absolute inset-0 w-full h-full" />

      {/* HUD Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-zinc-200 text-xs font-semibold text-zinc-800 shadow-sm">
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: VERDICT_GLOW[verdictState] }}
          />
          <span className="truncate max-w-[140px]">{originName}</span>
          <span className="text-zinc-400 shrink-0">→</span>
          <span className="truncate max-w-[140px]">{destinationName}</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-sm border border-zinc-200 text-[11px] text-zinc-600 shadow-sm">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: VERDICT_GLOW[verdictState] }}
          />
          <span className="capitalize">{verdictState}</span>
        </div>
      </div>

      {/* Route Legend */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-zinc-200 text-[11px] text-zinc-700 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span
              className="w-4 h-1 rounded-full"
              style={{ backgroundColor: getRouteColor(primaryRoute) }}
            />
            <span className="font-medium">
              {primaryRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.line ?? primaryRoute.name}
            </span>
          </div>
          {planBRoute && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-px border-t-2 border-dashed"
                style={{ borderColor: getRouteColor(planBRoute) }}
              />
              <span className="text-zinc-500">
                {planBRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.line ?? planBRoute.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Observer debug badge */}
      <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
        <div className="px-2 py-1 rounded-md bg-white/80 border border-zinc-200 text-[10px] font-mono text-zinc-500">
          {dimensions.width}×{dimensions.height}
        </div>
      </div>

      {!mapLoaded && (
        <div className="absolute inset-0 bg-zinc-50 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs">
            <div className="h-5 w-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
            <span>Loading map…</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Map rendering helpers ---

function renderRoutes(
  map: MapInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapboxgl: any,
  primaryRoute: RouteCandidate,
  planBRoute: RouteCandidate | undefined,
  selectedRoute: RouteCandidate,
  verdictState: VerdictState,
) {
  void mapboxgl; // suppress unused warning — used via map API
  const primaryCoords = ROUTE_GEOJSON[primaryRoute.id] ?? ROUTE_GEOJSON['candidate-path-33'];
  const planBCoords = planBRoute ? (ROUTE_GEOJSON[planBRoute.id] ?? null) : null;
  const primaryColor = getRouteColor(primaryRoute);
  const planBColor = planBRoute ? getRouteColor(planBRoute) : '#94a3b8';
  const verdictColor = VERDICT_GLOW[verdictState];

  const isPrimarySelected = selectedRoute.id === primaryRoute.id;

  // Plan B route (drawn first = below primary)
  if (planBCoords && planBRoute) {
    map.addSource('planb-route-src', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: planBCoords },
      },
    });
    map.addLayer({
      id: 'planb-route-outline',
      type: 'line',
      source: 'planb-route-src',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': !isPrimarySelected ? 7 : 5,
        'line-opacity': 0.8,
      },
    });
    map.addLayer({
      id: 'planb-route',
      type: 'line',
      source: 'planb-route-src',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': planBColor,
        'line-width': !isPrimarySelected ? 5 : 3,
        'line-opacity': isPrimarySelected ? 0.5 : 0.9,
        'line-dasharray': [2.5, 2],
      },
    });
  }

  // Primary route (drawn on top)
  map.addSource('primary-route-src', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: primaryCoords },
    },
  });
  // White outline/glow
  map.addLayer({
    id: 'primary-route-outline',
    type: 'line',
    source: 'primary-route-src',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': isPrimarySelected ? verdictColor : '#ffffff',
      'line-width': isPrimarySelected ? 9 : 6,
      'line-opacity': isPrimarySelected ? 0.3 : 0.8,
    },
  });
  map.addLayer({
    id: 'primary-route',
    type: 'line',
    source: 'primary-route-src',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': primaryColor,
      'line-width': isPrimarySelected ? 5 : 3,
      'line-opacity': isPrimarySelected ? 1.0 : 0.6,
    },
  });
}

function renderStations(
  map: MapInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapboxgl: any,
  primaryRoute: RouteCandidate,
  planBRoute: RouteCandidate | undefined,
  originName: string,
  destinationName: string,
) {
  void mapboxgl;

  const primaryCoords = ROUTE_GEOJSON[primaryRoute.id] ?? ROUTE_GEOJSON['candidate-path-33'];
  const originCoord = primaryCoords[0];
  const destCoord = primaryCoords[primaryCoords.length - 1];

  // Intermediate transfer stations (exclude first and last)
  const transferCoords = primaryCoords.slice(1, -1);

  // Origin pin
  map.addSource('station-origin-src', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: { label: originName },
      geometry: { type: 'Point', coordinates: originCoord },
    },
  });
  map.addLayer({
    id: 'origin-pin',
    type: 'circle',
    source: 'station-origin-src',
    paint: {
      'circle-radius': 8,
      'circle-color': '#18181b',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'origin-label',
    type: 'symbol',
    source: 'station-origin-src',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1],
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#18181b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  });

  // Destination pin
  map.addSource('station-dest-src', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: { label: destinationName },
      geometry: { type: 'Point', coordinates: destCoord },
    },
  });
  map.addLayer({
    id: 'destination-pin',
    type: 'circle',
    source: 'station-dest-src',
    paint: {
      'circle-radius': 8,
      'circle-color': '#18181b',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'destination-label',
    type: 'symbol',
    source: 'station-dest-src',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-anchor': 'bottom',
      'text-offset': [0, -1],
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#18181b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  });

  // Transfer node dots
  if (transferCoords.length > 0) {
    map.addSource('station-transfers-src', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: transferCoords.map((coord, i) => ({
          type: 'Feature',
          properties: { label: `Stop ${i + 1}` },
          geometry: { type: 'Point', coordinates: coord },
        })),
      },
    });
    map.addLayer({
      id: 'transfer-pins',
      type: 'circle',
      source: 'station-transfers-src',
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#94a3b8',
      },
    });
  }

  // Animated vehicle dot (mid-route position)
  const midIdx = Math.floor(primaryCoords.length / 2);
  const vehicleCoord = primaryCoords[midIdx];
  map.addSource('vehicle-src', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: vehicleCoord },
    },
  });
  map.addLayer({
    id: 'vehicle-dot',
    type: 'circle',
    source: 'vehicle-src',
    paint: {
      'circle-radius': 6,
      'circle-color': getRouteColor(primaryRoute),
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
}

// --- Fallback SVG map (shown when no Mapbox token) ---
interface FallbackMapProps {
  primaryRoute: RouteCandidate;
  planBRoute?: RouteCandidate;
  selectedRoute: RouteCandidate;
  verdictState: VerdictState;
  originName: string;
  destinationName: string;
  dimensions: { width: number; height: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function FallbackMap({
  primaryRoute,
  planBRoute,
  selectedRoute,
  verdictState,
  originName,
  destinationName,
  dimensions,
  containerRef,
}: FallbackMapProps) {
  const isPrimary = selectedRoute.id === primaryRoute.id;
  const verdictColor = VERDICT_GLOW[verdictState];
  const primaryColor = getRouteColor(primaryRoute);
  const planBColor = planBRoute ? getRouteColor(planBRoute) : '#94a3b8';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[320px] rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between"
    >
      {/* HUD Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 border border-zinc-200 text-xs font-semibold text-zinc-800 shadow-sm">
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: verdictColor }}
          />
          <span className="truncate max-w-[130px]">{originName}</span>
          <span className="text-zinc-400">→</span>
          <span className="truncate max-w-[130px]">{destinationName}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 border border-zinc-200 text-[11px] text-zinc-600 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: verdictColor }} />
          <span className="capitalize">{verdictState}</span>
        </div>
      </div>

      {/* Vector canvas */}
      <div className="absolute inset-0 bg-[#f8fafc] flex items-center justify-center overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 620 380" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          <defs>
            <pattern id="grid2" width="38" height="38" patternUnits="userSpaceOnUse">
              <path d="M 38 0 L 0 0 0 38" fill="none" stroke="#f1f5f9" strokeWidth="1" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid2)" />

          {/* Hudson River */}
          <path
            d="M 285,0 Q 275,110 292,195 T 288,380 L 360,380 Q 350,195 365,110 T 358,0 Z"
            fill="#e8f0fe"
            stroke="#c7d7f0"
            strokeWidth="1"
          />
          <text x="306" y="220" fill="#93a3b8" fontSize="9" fontWeight="500" letterSpacing="1" textAnchor="middle">
            HUDSON RIVER
          </text>

          {/* Region labels */}
          <text x="100" y="44" fill="#94a3b8" fontSize="11" fontWeight="700" letterSpacing="3">NJ</text>
          <text x="420" y="44" fill="#94a3b8" fontSize="11" fontWeight="700" letterSpacing="3">MANHATTAN</text>

          {/* Plan B route (drawn below primary) */}
          {planBRoute && (
            <path
              d="M 158,235 C 188,170 248,148 328,148 C 404,148 424,138 478,130"
              fill="none"
              stroke={planBColor}
              strokeWidth={!isPrimary ? 4 : 2.5}
              strokeDasharray="6 4"
              strokeLinecap="round"
              opacity={isPrimary ? 0.5 : 0.9}
            />
          )}

          {/* Primary route with verdict glow */}
          <path
            d="M 158,235 C 220,235 262,206 328,206 C 398,206 420,158 478,130"
            fill="none"
            stroke={isPrimary ? verdictColor : '#cbd5e1'}
            strokeWidth={isPrimary ? 8 : 5}
            strokeLinecap="round"
            opacity={0.25}
            filter="url(#glow)"
          />
          <path
            d="M 158,235 C 220,235 262,206 328,206 C 398,206 420,158 478,130"
            fill="none"
            stroke={primaryColor}
            strokeWidth={isPrimary ? 4.5 : 2.5}
            strokeLinecap="round"
            opacity={isPrimary ? 1.0 : 0.6}
          />

          {/* Midpoint animated vehicle */}
          <circle cx="328" cy="206" r="6" fill={primaryColor} stroke="#fff" strokeWidth="2" />

          {/* Transfer nodes */}
          {[220, 262, 398, 420].map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={i < 2 ? 235 - (i * 5) : 206 - ((i - 2) * 12)}
              r="3.5"
              fill="#fff"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
          ))}

          {/* Origin pin */}
          <circle cx="158" cy="235" r="7" fill="#18181b" />
          <circle cx="158" cy="235" r="3" fill="#fff" />
          <text x="118" y="256" fill="#18181b" fontSize="10" fontWeight="700">
            {originName.split(' ').slice(0, 2).join(' ')}
          </text>

          {/* Destination pin */}
          <circle cx="478" cy="130" r="7" fill="#18181b" />
          <circle cx="478" cy="130" r="3" fill="#fff" />
          <text x="434" y="118" fill="#18181b" fontSize="10" fontWeight="700">
            {destinationName.split(' ').slice(0, 2).join(' ')}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/95 border border-zinc-200 text-xs text-zinc-700 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-[11px] font-medium">
              {primaryRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.line ?? primaryRoute.name}
            </span>
          </div>
          {planBRoute && (
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: planBColor }} />
              <span className="text-[11px] text-zinc-500">
                {planBRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.line ?? planBRoute.name}
              </span>
            </div>
          )}
        </div>
        <div className="px-2 py-1 rounded-md bg-white/80 border border-zinc-200 text-[10px] font-mono text-zinc-500">
          {dimensions.width}×{dimensions.height}
        </div>
      </div>

      {/* No token warning */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700 font-medium shadow-sm">
          Add <code className="font-mono bg-amber-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to .env for the live map
        </div>
      </div>
    </div>
  );
}
