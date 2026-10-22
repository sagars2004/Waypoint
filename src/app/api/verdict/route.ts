import { NextResponse } from 'next/server';
import { feedManager, ReplayScenarioKey } from '@/services/feedManager';
import { RouteGenerator } from '@/services/routeGenerator';
import { RiskScorer } from '@/services/riskScorer';
import { CommuteProfile, CommuteProfileSchema, VerdictResponseSchema } from '@/types/schemas';
import { SAMPLE_PROFILES } from '@/data/mockCorridors';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scenario: ReplayScenarioKey = body.scenario || 'normal';

    // Parse or fallback to sample profile
    let profile: CommuteProfile = SAMPLE_PROFILES[0];
    if (body.profile) {
      profile = CommuteProfileSchema.parse(body.profile);
    }

    // 1. Ingest feed snapshot
    const snapshot = feedManager.getSnapshot(scenario);
    const feedStatuses = feedManager.evaluateSources(snapshot);

    // 2. Generate and score candidates deterministically
    const candidates = RouteGenerator.generateCandidates(profile, snapshot);
    const { primaryRoute, planBRoute } = RouteGenerator.selectPrimaryAndPlanB(candidates);

    // 3. Evaluate verdict state and confidence
    const state = RiskScorer.evaluateVerdictState(primaryRoute, candidates, snapshot);
    const confidence = RiskScorer.evaluateConfidence(feedStatuses, primaryRoute);

    // 4. Calculate countdown minutes from reference time or now
    const countdownMinutes = RiskScorer.computeCountdown(primaryRoute.departureTime, '08:00');

    // 5. Synthesize deterministic reason (pre-LLM rule synthesis)
    // Include all active alerts from the snapshot so riders see alerts causing reroutes
    const activeAlerts = snapshot.alerts;

    let reason = '';
    if (state === 'reroute') {
      reason = `Primary line suspended due to power/track incident. Reroute immediately to ${primaryRoute.name} departing at ${primaryRoute.departureTime} AM.`;
    } else if (state === 'tight') {
      const delayedLeg = primaryRoute.legs.find((l) => l.delayMinutes > 0);
      const delay = delayedLeg?.delayMinutes || 9;
      reason = `${delayedLeg?.line || 'Primary route'} has ${delay}-min signal delays. Leave by ${primaryRoute.departureTime} AM to keep an arrival margin.`;
    } else {
      reason = `${primaryRoute.name} is running smoothly with ${primaryRoute.reliabilityRate}% reliability. A ${primaryRoute.bufferMinutes}-minute buffer ensures comfortable arrival.`;
    }

    // 6. Build and validate response against Zod schema
    const verdictPayload = {
      state,
      confidence,
      leaveByTime: primaryRoute.departureTime,
      countdownMinutes,
      reason,
      primaryRoute,
      planBRoute,
      allCandidates: candidates,
      alerts: activeAlerts,
      freshnessTimestamp: `Updated ${feedStatuses[0]?.lastAgeSeconds || 14}s ago`,
      feedStatus: feedStatuses,
    };

    const validatedResponse = VerdictResponseSchema.parse(verdictPayload);

    return NextResponse.json({
      success: true,
      verdict: validatedResponse,
    });
  } catch (error) {
    console.error('Error generating verdict:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
