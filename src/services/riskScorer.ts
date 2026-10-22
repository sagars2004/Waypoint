import { 
  RouteCandidate, 
  VerdictState, 
  ConfidenceLevel, 
  FeedSnapshot, 
  CommuteProfile, 
  FeedSourceStatus 
} from '@/types/schemas';

export interface ScoredRouteCandidate extends RouteCandidate {
  rawBufferMinutes: number;
}

export class RiskScorer {
  /**
   * Calculates required safety buffer in minutes for ~90% on-time confidence
   */
  public static calculateBufferMinutes(
    candidate: Omit<RouteCandidate, 'bufferMinutes' | 'riskScore'>,
    snapshot: FeedSnapshot,
    riskTolerance: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
  ): { bufferMinutes: number; riskScore: number } {
    let buffer = 4; // Base safety margin

    // 1. Line reliability variance buffer: lower historical OTP requires higher buffer
    const unreliability = 100 - candidate.reliabilityRate;
    const reliabilityBuffer = Math.ceil(unreliability * 0.35);
    buffer += reliabilityBuffer;

    // 2. Transfer penalty: each transfer adds risk of missed connection
    if (candidate.transfersCount > 0) {
      buffer += candidate.transfersCount * 4;
    }

    // 3. Realtime delay volatility: active delays are prone to cascading
    const maxLegDelay = Math.max(0, ...candidate.legs.map((l) => l.delayMinutes));
    if (maxLegDelay >= 999) {
      // Line is suspended
      return { bufferMinutes: 999, riskScore: 100 };
    }
    if (maxLegDelay > 0) {
      buffer += Math.ceil(maxLegDelay * 0.4);
    }

    // 4. Weather impact
    if (snapshot.weather) {
      if (snapshot.weather.isSevere) {
        buffer += 6;
      }
      // High wind affects ferries
      const isFerry = candidate.legs.some((l) => l.mode === 'ferry');
      if (isFerry && snapshot.weather.windSpeedMph > 20) {
        buffer += 5;
      }
    }

    // 5. User risk tolerance tuning
    if (riskTolerance === 'conservative') {
      buffer += 5;
    } else if (riskTolerance === 'aggressive') {
      buffer = Math.max(3, buffer - 3);
    }

    // Calculate composite risk score (0 to 100, where 0 is safest)
    let risk = Math.round(
      unreliability * 0.4 +
      maxLegDelay * 3.5 +
      candidate.transfersCount * 12 +
      (snapshot.weather?.isSevere ? 15 : 0)
    );
    risk = Math.max(5, Math.min(100, risk));

    return {
      bufferMinutes: buffer,
      riskScore: risk,
    };
  }

  /**
   * Determines the Verdict state (comfortable, tight, reroute)
   */
  public static evaluateVerdictState(
    primary: RouteCandidate,
    allCandidates: RouteCandidate[],
    snapshot: FeedSnapshot
  ): VerdictState {
    const hasCorridorSuspension = 
      snapshot.scenario === 'reroute' ||
      allCandidates.some((c) => c.legs.some((l) => l.delayMinutes >= 999));

    if (hasCorridorSuspension || primary.riskScore >= 75) {
      return 'reroute';
    }

    const hasSignificantDelay = 
      snapshot.scenario === 'delay' ||
      allCandidates.some((c) => c.legs.some((l) => l.delayMinutes >= 6));

    if (primary.riskScore >= 40 || hasSignificantDelay || primary.reliabilityRate < 80) {
      return 'tight';
    }

    return 'comfortable';
  }

  /**
   * Determines confidence level (high, medium, low) factoring in feed freshness and volatility
   */
  public static evaluateConfidence(
    feedStatuses: FeedSourceStatus[],
    primary: RouteCandidate
  ): ConfidenceLevel {
    const anyOffline = feedStatuses.some((s) => s.status === 'offline');
    if (anyOffline) {
      return 'low'; // Degraded mode: one or more feeds down
    }

    const anyStale = feedStatuses.some((s) => s.status === 'stale');
    if (anyStale || primary.reliabilityRate < 75 || primary.riskScore > 60) {
      return 'medium';
    }

    return 'high';
  }

  /**
   * Calculates "leave by" time given arrive-by time string (e.g. "09:00") and duration + buffer
   */
  public static computeLeaveByTime(
    arriveBy: string,
    durationMinutes: number,
    bufferMinutes: number
  ): { leaveByTime: string; totalLeadMinutes: number } {
    const [hours, minutes] = arriveBy.split(':').map(Number);
    const totalLeadMinutes = durationMinutes + bufferMinutes;

    let totalArriveMinutes = hours * 60 + minutes;
    let leaveMinutes = totalArriveMinutes - totalLeadMinutes;

    if (leaveMinutes < 0) {
      leaveMinutes += 24 * 60;
    }

    const leaveHour = Math.floor(leaveMinutes / 60) % 24;
    const leaveMin = leaveMinutes % 60;

    const formatted = `${String(leaveHour).padStart(2, '0')}:${String(leaveMin).padStart(2, '0')}`;
    return { leaveByTime: formatted, totalLeadMinutes };
  }

  /**
   * Calculates minutes remaining until leave-by time from a reference time
   */
  public static computeCountdown(leaveByTime: string, referenceTimeStr: string = '08:00'): number {
    const [lH, lM] = leaveByTime.split(':').map(Number);
    const [rH, rM] = referenceTimeStr.split(':').map(Number);

    const lTotal = lH * 60 + lM;
    const rTotal = rH * 60 + rM;

    return Math.max(0, lTotal - rTotal);
  }
}
