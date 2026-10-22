import { z } from 'zod';

export const TransitModeSchema = z.enum([
  'path',
  'rail',
  'bus',
  'ferry',
  'driving',
]);

export const VerdictStateSchema = z.enum([
  'comfortable',
  'tight',
  'reroute',
]);

export const ConfidenceLevelSchema = z.enum([
  'high',
  'medium',
  'low',
]);

export const LeadAgentOutputSchema = z.object({
  state: VerdictStateSchema,
  confidence: ConfidenceLevelSchema,
  reason: z.string().min(5),
}).strict();

export const RouteLegSchema = z.object({
  id: z.string(),
  mode: TransitModeSchema,
  line: z.string(),
  lineColor: z.string().optional(),
  fromName: z.string(),
  toName: z.string(),
  departureTime: z.string(), // "HH:MM"
  arrivalTime: z.string(),   // "HH:MM"
  durationMinutes: z.number().int().nonnegative(),
  statusText: z.string().optional(),
  delayMinutes: z.number().int().default(0),
  coordinates: z.array(z.tuple([z.number(), z.number()])).optional(),
});

export const RouteCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  totalDurationMinutes: z.number().int().positive(),
  transfersCount: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  riskScore: z.number().min(0).max(100),
  reliabilityRate: z.number().min(0).max(100),
  bufferMinutes: z.number().int(),
  legs: z.array(RouteLegSchema).min(1),
  isPlanB: z.boolean().optional(),
});

export const TransitAlertSchema = z.object({
  id: z.string(),
  agency: z.enum(['PATH', 'NJ Transit', 'MTA', 'NY Waterway', 'NYC DOT', 'System']),
  line: z.string(),
  severity: z.enum(['low', 'moderate', 'severe']),
  title: z.string(),
  description: z.string(),
  timestamp: z.string(),
  expectedDuration: z.string().optional(),
});

export const FeedSourceStatusSchema = z.object({
  source: z.string(),
  agency: z.string(),
  status: z.enum(['fresh', 'stale', 'offline']),
  lastAgeSeconds: z.number().int().nonnegative(),
  lastUpdated: z.string(),
});

export const CommuteProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: z.object({
    name: z.string(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
    stopId: z.string().optional(),
    agency: z.string().optional(),
    mode: TransitModeSchema.optional(),
  }),
  destination: z.object({
    name: z.string(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
    stopId: z.string().optional(),
    agency: z.string().optional(),
    mode: TransitModeSchema.optional(),
  }),
  arriveByTime: z.string(), // "09:00"
  acceptedModes: z.array(TransitModeSchema).min(1),
  preferences: z.object({
    avoidTransfers: z.boolean(),
    maxWalkingMinutes: z.number().int().positive().default(15),
    riskTolerance: z.enum(['conservative', 'balanced', 'aggressive']).default('balanced'),
    allowFerries: z.boolean().default(true),
    allowDriving: z.boolean().default(false),
  }),
});

export const VerdictResponseSchema = z.object({
  state: VerdictStateSchema,
  confidence: ConfidenceLevelSchema,
  leaveByTime: z.string(),
  countdownMinutes: z.number().int(),
  reason: z.string().min(5),
  primaryRoute: RouteCandidateSchema,
  planBRoute: RouteCandidateSchema.optional(),
  allCandidates: z.array(RouteCandidateSchema),
  alerts: z.array(TransitAlertSchema),
  freshnessTimestamp: z.string(),
  feedStatus: z.array(FeedSourceStatusSchema),
});

export const FeedSnapshotSchema = z.object({
  feedId: z.string(),
  source: z.string(),
  agency: z.string(),
  fetchedAt: z.string(), // ISO String
  scenario: z.enum(['normal', 'delay', 'reroute', 'outage']),
  realtimeDelayMinutes: z.record(z.string(), z.number()), // lineId -> delay in minutes
  alerts: z.array(TransitAlertSchema),
  reliabilityOtp: z.record(z.string(), z.number()),      // lineId -> OTP percentage
  weather: z.object({
    temperatureF: z.number(),
    condition: z.string(),
    isSevere: z.boolean(),
    windSpeedMph: z.number(),
  }).optional(),
  trafficTunnels: z.record(z.string(), z.object({
    crossing: z.string(),
    travelTimeMinutes: z.number(),
    delayVsTypicalMinutes: z.number(),
    tollAmount: z.number(),
  })).optional(),
});

export type TransitMode = z.infer<typeof TransitModeSchema>;
export type VerdictState = z.infer<typeof VerdictStateSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type LeadAgentOutput = z.infer<typeof LeadAgentOutputSchema>;
export type RouteLeg = z.infer<typeof RouteLegSchema>;
export type RouteCandidate = z.infer<typeof RouteCandidateSchema>;
export type TransitAlert = z.infer<typeof TransitAlertSchema>;
export type FeedSourceStatus = z.infer<typeof FeedSourceStatusSchema>;
export type CommuteProfile = z.infer<typeof CommuteProfileSchema>;
export type VerdictResponse = z.infer<typeof VerdictResponseSchema>;
export type FeedSnapshot = z.infer<typeof FeedSnapshotSchema>;
