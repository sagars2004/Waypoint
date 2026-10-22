import { 
  RouteCandidate, 
  TransitAlert, 
  VerdictState, 
  ConfidenceLevel, 
  FeedSourceStatus 
} from '@/types/schemas';
import { LeadAgentOutputSchema } from '@/types/schemas';
import { nebiusClient } from './nebiusClient';
import { Client as LangSmithClient } from 'langsmith';

export interface LeadAgentVerdictInput {
  origin: string;
  destination: string;
  arriveByTime: string;
  candidates: RouteCandidate[];
  alerts: TransitAlert[];
  feedStatuses: FeedSourceStatus[];
  baseVerdictState: VerdictState;
  baseConfidence: ConfidenceLevel;
}

export interface LeadAgentVerdictOutput {
  state: VerdictState;
  confidence: ConfidenceLevel;
  reason: string;
  modelUsed: string;
  traceUrl?: string;
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function capConfidence(
  modelConfidence: ConfidenceLevel,
  baseConfidence: ConfidenceLevel
): ConfidenceLevel {
  return CONFIDENCE_RANK[modelConfidence] <= CONFIDENCE_RANK[baseConfidence]
    ? modelConfidence
    : baseConfidence;
}

function deterministicReason(
  input: LeadAgentVerdictInput,
  primaryCandidate: RouteCandidate
): string {
  if (input.baseVerdictState === 'reroute') {
    return `Primary line suspended due to track/power emergency. Reroute immediately to ${primaryCandidate.name} at ${primaryCandidate.departureTime} AM.`;
  }
  if (input.baseVerdictState === 'tight') {
    return `Corridor signal delays are present. Leave by ${primaryCandidate.departureTime} AM to maintain an arrival safety margin.`;
  }
  return `${primaryCandidate.name} is running smoothly with ${primaryCandidate.reliabilityRate}% historical reliability. Allocated buffer of ${primaryCandidate.bufferMinutes} minutes ensures comfortable on-time arrival.`;
}

function normalizeTime(time: string): string {
  const [hours, minutes] = time.trim().split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return time;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function hasGroundedTimes(reason: string, input: LeadAgentVerdictInput): boolean {
  const allowedTimes = new Set([
    normalizeTime(input.arriveByTime),
    ...input.candidates.flatMap((candidate) => [
      normalizeTime(candidate.departureTime),
      normalizeTime(candidate.arrivalTime),
      ...candidate.legs.flatMap((leg) => [
        normalizeTime(leg.departureTime),
        normalizeTime(leg.arrivalTime),
      ]),
    ]),
  ]);
  const citedTimes = reason.match(/\b\d{1,2}:\d{2}\s?(?:AM|PM)?\b/gi) || [];

  return citedTimes.every((time) => allowedTimes.has(normalizeTime(time.slice(0, 5))));
}

export class LeadAgent {
  private static instance: LeadAgent;
  private langsmithClient: LangSmithClient | null = null;

  private constructor() {
    if (process.env.LANGSMITH_API_KEY) {
      try {
        this.langsmithClient = new LangSmithClient({
          apiKey: process.env.LANGSMITH_API_KEY,
        });
      } catch (e) {
        console.warn('LangSmith initialization skipped:', e);
      }
    }
  }

  public static getInstance(): LeadAgent {
    if (!LeadAgent.instance) {
      LeadAgent.instance = new LeadAgent();
    }
    return LeadAgent.instance;
  }

  /**
   * Evaluates structured corridor telemetry using NVIDIA Nemotron 3 on Nebius Token Factory
   */
  public async evaluateVerdict(input: LeadAgentVerdictInput): Promise<LeadAgentVerdictOutput> {
    const client = nebiusClient.getClient();
    const primaryCandidate = input.candidates[0];

    // If Nebius is not configured, fallback to rule-synthesized rationale immediately
    if (!primaryCandidate) {
      throw new Error('Cannot evaluate a verdict without a primary route.');
    }

    if (!client) {
      return {
        state: input.baseVerdictState,
        confidence: input.baseConfidence,
        reason: deterministicReason(input, primaryCandidate),
        modelUsed: 'Deterministic Engine (Rules Fallback)',
      };
    }

    // System prompt enforcing strict anti-hallucination rules (PRD principle: never invent departures)
    const systemPrompt = `You are the lead transit reasoning agent for Waypoint, powered by NVIDIA Nemotron on Nebius Token Factory.
Your job is to reason over deterministic transit candidates and telemetry to produce a crisp, 1-2 sentence leave-by rationale for the commuter.

CRITICAL RULES:
1. You may ONLY cite departure times, duration, buffer minutes, and costs provided in the candidate data. NEVER invent departure times.
2. Emphasize risk, certainty, and safety buffers over simple arrival minutes.
3. If an alert or suspension is present, explicitly state why the user is rerouted or why departure must be earlier.
4. Output strict JSON matching this schema:
{
  "state": "comfortable" | "tight" | "reroute",
  "confidence": "high" | "medium" | "low",
  "reason": "One to two sentences stating the verdict, departure recommendation, and why."
}`;

    const userPrompt = JSON.stringify({
      corridor: `${input.origin} to ${input.destination}`,
      targetArrival: `${input.arriveByTime} AM`,
      recommendedPrimaryOption: {
        name: primaryCandidate.name,
        leaveByTime: `${primaryCandidate.departureTime} AM`,
        duration: `${primaryCandidate.totalDurationMinutes} mins`,
        bufferMargin: `+${primaryCandidate.bufferMinutes} mins`,
        reliability: `${primaryCandidate.reliabilityRate}%`,
      },
      planBAlternative: input.candidates[1] ? {
        name: input.candidates[1].name,
        leaveByTime: `${input.candidates[1].departureTime} AM`,
        duration: `${input.candidates[1].totalDurationMinutes} mins`,
      } : null,
      activeAlerts: input.alerts.map((a) => `${a.agency} - ${a.title}: ${a.description}`),
      baseAssessedState: input.baseVerdictState,
      feedFreshness: input.feedStatuses.map((s) => `${s.source}: ${s.status} (${s.lastUpdated})`),
    }, null, 2);

    try {
      const model = nebiusClient.getUltraModel();
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = LeadAgentOutputSchema.parse(JSON.parse(cleanJson));

      if (!hasGroundedTimes(parsed.reason, input)) {
        throw new Error('Lead agent reason cited a time not present in route data.');
      }

      return {
        // Deterministic scoring owns the verdict state; the model only explains it.
        state: input.baseVerdictState,
        confidence: capConfidence(parsed.confidence, input.baseConfidence),
        reason: parsed.reason,
        modelUsed: `NVIDIA Nemotron (${model}) via Nebius`,
      };
    } catch (err) {
      console.warn('Nebius Nemotron call failed, using deterministic fallback:', err);
      return {
        state: input.baseVerdictState,
        confidence: input.baseConfidence,
        reason: deterministicReason(input, primaryCandidate),
        modelUsed: 'Deterministic Fallback (API error)',
      };
    }
  }
}

export const leadAgent = LeadAgent.getInstance();
