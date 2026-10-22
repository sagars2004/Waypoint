import { 
  RouteCandidate, 
  TransitAlert, 
  VerdictState, 
  ConfidenceLevel, 
  FeedSourceStatus 
} from '@/types/schemas';
import { LeadAgentOutputSchema } from '@/types/schemas';
import { nebiusClient } from './nebiusClient';
import { Client as LangSmithClient, RunTree } from 'langsmith';
import { formatTime12 } from '@/lib/time';

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
    return `Primary line suspended due to track/power emergency. Reroute immediately to ${primaryCandidate.name} at ${formatTime12(primaryCandidate.departureTime)}.`;
  }
  if (input.baseVerdictState === 'tight') {
    return `Corridor signal delays are present. Leave by ${formatTime12(primaryCandidate.departureTime)} to maintain an arrival safety margin.`;
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

  private async startTrace(
    input: LeadAgentVerdictInput,
    primaryCandidate: RouteCandidate
  ): Promise<RunTree | null> {
    if (!this.langsmithClient) return null;

    const trace = new RunTree({
      name: 'waypoint.lead_agent.verdict',
      run_type: 'chain',
      project_name: process.env.LANGCHAIN_PROJECT || 'waypoint',
      client: this.langsmithClient,
      tags: ['waypoint', 'verdict', input.baseVerdictState],
      inputs: {
        corridor: `${input.origin} to ${input.destination}`,
        arriveByTime: input.arriveByTime,
        primaryRoute: primaryCandidate.id,
        candidateCount: input.candidates.length,
        alertCount: input.alerts.length,
        feedStatuses: input.feedStatuses.map((status) => ({
          source: status.source,
          status: status.status,
          ageSeconds: status.lastAgeSeconds,
        })),
      },
    });

    try {
      await trace.postRun();
      return trace;
    } catch (error) {
      console.warn('LangSmith trace start failed; continuing without tracing:', error);
      return null;
    }
  }

  private async finishTrace(
    trace: RunTree | null,
    output?: LeadAgentVerdictOutput,
    error?: unknown
  ): Promise<void> {
    if (!trace) return;

    try {
      if (error) {
        await trace.end(undefined, String(error));
      } else {
        await trace.end({
          state: output?.state,
          confidence: output?.confidence,
          modelUsed: output?.modelUsed,
          reason: output?.reason,
        });
      }
      await trace.postRun();
    } catch (traceError) {
      console.warn('LangSmith trace completion failed:', traceError);
    }
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

    const trace = await this.startTrace(input, primaryCandidate);

    if (!client) {
      const output = {
        state: input.baseVerdictState,
        confidence: input.baseConfidence,
        reason: deterministicReason(input, primaryCandidate),
        modelUsed: 'Deterministic Engine (Rules Fallback)',
      };
      await this.finishTrace(trace, output);
      return output;
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
      targetArrival: formatTime12(input.arriveByTime),
      recommendedPrimaryOption: {
        name: primaryCandidate.name,
        leaveByTime: formatTime12(primaryCandidate.departureTime),
        duration: `${primaryCandidate.totalDurationMinutes} mins`,
        bufferMargin: `+${primaryCandidate.bufferMinutes} mins`,
        reliability: `${primaryCandidate.reliabilityRate}%`,
      },
      planBAlternative: input.candidates[1] ? {
        name: input.candidates[1].name,
        leaveByTime: formatTime12(input.candidates[1].departureTime),
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

      const output = {
        // Deterministic scoring owns the verdict state; the model only explains it.
        state: input.baseVerdictState,
        confidence: capConfidence(parsed.confidence, input.baseConfidence),
        reason: parsed.reason,
        modelUsed: `NVIDIA Nemotron (${model}) via Nebius`,
      };
      await this.finishTrace(trace, output);
      return output;
    } catch (err) {
      console.warn('Nebius Nemotron call failed, using deterministic fallback:', err);
      const output = {
        state: input.baseVerdictState,
        confidence: input.baseConfidence,
        reason: deterministicReason(input, primaryCandidate),
        modelUsed: 'Deterministic Fallback (API error)',
      };
      await this.finishTrace(trace, output, err);
      return output;
    }
  }
}

export const leadAgent = LeadAgent.getInstance();
