export type TransitMode = 'rail' | 'path' | 'bus' | 'ferry' | 'driving';

export type VerdictState = 'comfortable' | 'tight' | 'reroute';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface CommuteProfile {
  id: string;
  name: string;
  origin: {
    name: string;
    coordinates?: [number, number]; // [lng, lat]
  };
  destination: {
    name: string;
    coordinates?: [number, number];
  };
  arriveByTime: string; // e.g. "09:00"
  acceptedModes: TransitMode[];
  preferences: {
    avoidTransfers: boolean;
    maxWalkingMinutes: number;
    riskTolerance: 'conservative' | 'balanced' | 'aggressive';
    allowFerries: boolean;
    allowDriving: boolean;
  };
}

export interface RouteLeg {
  id: string;
  mode: TransitMode;
  line: string;
  lineColor?: string;
  fromName: string;
  toName: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  statusText?: string;
  delayMinutes?: number;
  coordinates?: [number, number][]; // Polyline coordinates
}

export interface RouteCandidate {
  id: string;
  name: string;
  summary: string;
  departureTime: string; // "08:12"
  arrivalTime: string;   // "08:52"
  totalDurationMinutes: number;
  transfersCount: number;
  estimatedCost: number; // e.g. 2.90, 8.50
  riskScore: number;     // 0 to 100 (lower is safer)
  reliabilityRate: number; // e.g. 91 (91% on-time)
  bufferMinutes: number; // e.g. 8 mins safety margin
  legs: RouteLeg[];
  isPlanB?: boolean;
}

export interface TransitAlert {
  id: string;
  line: string;
  agency: 'PATH' | 'NJ Transit' | 'MTA' | 'NY Waterway' | 'NYC DOT';
  severity: 'low' | 'moderate' | 'severe';
  title: string;
  description: string;
  timestamp: string;
}

export interface Verdict {
  state: VerdictState;
  confidence: ConfidenceLevel;
  leaveByTime: string; // "08:12"
  countdownMinutes: number;
  reason: string;
  primaryRoute: RouteCandidate;
  planBRoute?: RouteCandidate;
  allCandidates: RouteCandidate[];
  alerts: TransitAlert[];
  freshnessTimestamp: string;
  feedStatus: {
    source: string;
    status: 'fresh' | 'stale' | 'offline';
    lastAgeSeconds: number;
  }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  dataCitations?: {
    source: string;
    metric: string;
  }[];
}
