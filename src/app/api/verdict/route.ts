import { NextResponse } from 'next/server';
import { feedManager, ReplayScenarioKey } from '@/services/feedManager';
import { RouteGenerator } from '@/services/routeGenerator';
import { RiskScorer } from '@/services/riskScorer';
import { CommuteProfile, CommuteProfileSchema, VerdictResponseSchema } from '@/types/schemas';
import { SAMPLE_PROFILES } from '@/data/mockCorridors';
import { leadAgent } from '@/services/ai/leadAgent';
import { tavilyAlertsSubagent } from '@/services/ai/tavilyAlertsSubagent';
import { tendemEscalationService } from '@/services/ai/tendemEscalation';
import { fetchLiveWeather } from '@/services/liveFeeds/weatherConnector';
import { njTransitConnector } from '@/services/liveFeeds/njTransitConnector';
import { nycDotTrafficConnector } from '@/services/liveFeeds/nycDotTrafficConnector';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scenario: ReplayScenarioKey = body.scenario || 'normal';
    const isLiveMode = Boolean(body.liveMode || process.env.USE_LIVE_FEEDS === 'true');

    // Parse or fallback to sample profile
    let profile: CommuteProfile = SAMPLE_PROFILES[0];
    if (body.profile) {
      profile = CommuteProfileSchema.parse(body.profile);
    }

    // 1. Ingest feed snapshot (or overlay live feeds if in live mode)
    const snapshot = feedManager.getSnapshot(scenario);

    // Overlay live weather (free Open-Meteo)
    const liveWeather = await fetchLiveWeather();
    snapshot.weather = liveWeather;

    // Overlay live NYC DOT traffic speeds (free keyless NYC OpenData)
    const liveCrossings = await nycDotTrafficConnector.fetchCrossingSpeeds();
    if (liveCrossings) {
      snapshot.trafficTunnels = {
        lincolnTunnel: {
          crossing: 'Lincoln Tunnel',
          travelTimeMinutes: liveCrossings.lincolnTunnel.travelTimeMinutes,
          delayVsTypicalMinutes: liveCrossings.lincolnTunnel.delayVsTypicalMinutes,
          tollAmount: liveCrossings.lincolnTunnel.tollAmount,
        },
        hollandTunnel: {
          crossing: 'Holland Tunnel',
          travelTimeMinutes: liveCrossings.hollandTunnel.travelTimeMinutes,
          delayVsTypicalMinutes: liveCrossings.hollandTunnel.delayVsTypicalMinutes,
          tollAmount: liveCrossings.hollandTunnel.tollAmount,
        },
      };
    }

    // Overlay live NJ Transit data if key exists and live mode enabled
    const liveNJT = await njTransitConnector.fetchLiveStatus();
    if (liveNJT && liveNJT.railDelays) {
      Object.assign(snapshot.realtimeDelayMinutes, liveNJT.railDelays);
      if (liveNJT.alerts.length > 0) {
        snapshot.alerts.push(...liveNJT.alerts);
      }
    }

    // Search live web incidents through Tavily if API key is configured
    if (process.env.TAVILY_API_KEY) {
      const tavilyAlerts = await tavilyAlertsSubagent.searchAgencyIncidents(
        `${profile.origin.name} ${profile.destination.name} transit delays`
      );
      if (tavilyAlerts.length > 0) {
        snapshot.alerts.push(...tavilyAlerts);
      }
    }

    // Deduplicate alerts by ID and title to guarantee unique keys and eliminate duplicates
    const seenAlertKeys = new Set<string>();
    snapshot.alerts = snapshot.alerts.filter((a) => {
      const key = `${a.id}-${a.title}`;
      if (seenAlertKeys.has(key)) return false;
      seenAlertKeys.add(key);
      return true;
    });

    const feedStatuses = feedManager.evaluateSources(snapshot);

    // 2. Generate and score candidates deterministically
    const candidates = RouteGenerator.generateCandidates(profile, snapshot);
    const { primaryRoute, planBRoute } = RouteGenerator.selectPrimaryAndPlanB(candidates);

    // 3. Evaluate baseline verdict state and confidence
    const baseState = RiskScorer.evaluateVerdictState(primaryRoute, candidates, snapshot);
    const baseConfidence = RiskScorer.evaluateConfidence(feedStatuses, primaryRoute);

    // 4. Calculate countdown minutes from reference time or now
    const countdownMinutes = RiskScorer.computeCountdown(primaryRoute.departureTime, '08:00');

    // 5. Lead Agent (Nemotron on Nebius Token Factory) evaluates rationale
    const agentResult = await leadAgent.evaluateVerdict({
      origin: profile.origin.name,
      destination: profile.destination.name,
      arriveByTime: profile.arriveByTime,
      candidates,
      alerts: snapshot.alerts,
      feedStatuses,
      baseVerdictState: baseState,
      baseConfidence: baseConfidence,
    });

    // 6. Tendem Human-in-the-Loop check
    const escalation = await tendemEscalationService.evaluateEscalation(
      agentResult.state,
      agentResult.confidence,
      primaryRoute,
      feedStatuses.some((s) => s.status === 'offline')
    );

    // 7. Build and validate response against Zod schema
    const verdictPayload = {
      state: agentResult.state,
      confidence: agentResult.confidence,
      leaveByTime: primaryRoute.departureTime,
      countdownMinutes,
      reason: agentResult.reason,
      primaryRoute,
      planBRoute,
      allCandidates: candidates,
      alerts: snapshot.alerts,
      freshnessTimestamp: `Updated ${feedStatuses[0]?.lastAgeSeconds || 14}s ago`,
      feedStatus: feedStatuses,
    };

    const validatedResponse = VerdictResponseSchema.parse(verdictPayload);

    return NextResponse.json({
      success: true,
      verdict: validatedResponse,
      modelUsed: agentResult.modelUsed,
      escalation,
    });
  } catch (error) {
    console.error('Error generating verdict:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
