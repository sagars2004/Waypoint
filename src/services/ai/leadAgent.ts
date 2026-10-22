import { 
  RouteCandidate, 
  TransitAlert, 
  VerdictState, 
  ConfidenceLevel, 
  FeedSourceStatus 
} from '@/types/schemas';
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
    if (!client || !primaryCandidate) {
      let defaultReason = '';
      if (input.baseVerdictState === 'reroute') {
        defaultReason = `Primary line suspended due to track/power emergency. Reroute immediately to ${primaryCandidate.name} at ${primaryCandidate.departureTime} AM.`;
      } else if (input.baseVerdictState === 'tight') {
        defaultReason = `Corridor signal delays present. Leave by ${primaryCandidate.departureTime} AM to maintain an arrival safety margin.`;
      } else {
        defaultReason = `${primaryCandidate.name} is running smoothly with ${primaryCandidate.reliabilityRate}% historical reliability. Allocated buffer of ${primaryCandidate.bufferMinutes} minutes ensures comfortable on-time arrival.`;
      }

      return {
        state: input.baseVerdictState,
        confidence: input.baseConfidence,
        reason: defaultReason,
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
      const parsed = JSON.parse(cleanJson);

      return {
        state: parsed.state || input.baseVerdictState,
        confidence: parsed.confidence || input.baseConfidence,
        reason: parsed.reason || `${primaryCandidate.name} leave by ${primaryCandidate.departureTime} AM.`,
        modelUsed: `NVIDIA Nemotron (${model}) via Nebius`,
      };
    } catch (err) {
      console.warn('Nebius Nemotron call failed, using deterministic fallback:', err);
      return {
        state: input.baseVerdictState,
        confidence: input.baseConfidence,
        reason: `${primaryCandidate.name} running on schedule. Allocated buffer of ${primaryCandidate.bufferMinutes} minutes ensures on-time arrival.`,
        modelUsed: 'Deterministic Fallback (API error)',
      };
    }
  }
}

export const leadAgent = LeadAgent.getInstance();
