import { 
  CommuteProfile, 
  RouteCandidate, 
  RouteLeg,
  FeedSnapshot, 
} from '@/types/schemas';
import { RiskScorer } from './riskScorer';

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function addMinutes(value: string, amount: number): string {
  return formatMinutes(timeToMinutes(value) + amount);
}

function normalizeAgency(agency?: string) {
  return (agency ?? '').trim().toLowerCase();
}

function serviceLabel(mode: CommuteProfile['acceptedModes'][number], agency?: string) {
  if (mode === 'path') return 'PATH';
  if (mode === 'ferry') return agency || 'Ferry';
  if (mode === 'bus') return agency || 'Transit Bus';
  if (mode === 'driving') return 'Driving';
  return agency || 'Rail';
}

function colorForMode(mode: CommuteProfile['acceptedModes'][number]) {
  return {
    path: '#0284c7',
    rail: '#e11d48',
    ferry: '#0d9488',
    bus: '#8b5cf6',
    driving: '#f97316',
  }[mode];
}

function fareForMode(mode: CommuteProfile['acceptedModes'][number]) {
  if (mode === 'ferry') return 8;
  if (mode === 'rail' || mode === 'path') return 2.75;
  if (mode === 'driving') return 25;
  return 3.5;
}

function chooseTransferStation(profile: CommuteProfile, originService: string, destinationService: string) {
  if (originService === 'LIRR' && destinationService === 'MTA Subway') return 'Atlantic Terminal';
  if (destinationService === 'LIRR') return 'Jamaica Station';
  if (originService === 'PATH' && destinationService === 'MTA Subway') return '33 St–Herald Sq';
  if (originService === 'NJ Transit' && destinationService === 'MTA Subway') return 'NY Penn Station';
  return `${profile.origin.name} connection`;
}

function buildLeg(leg: RouteLeg): RouteLeg {
  return leg;
}

export class RouteGenerator {
  /**
   * Generates candidate routes for a given commute profile and feed snapshot
   */
  public static generateCandidates(
    profile: CommuteProfile,
    snapshot: FeedSnapshot
  ): RouteCandidate[] {
    const isJC = profile.origin.name.toLowerCase().includes('exchange') ||
                 profile.origin.name.toLowerCase().includes('jersey city') ||
                 profile.id.includes('jc') ||
                 ['exchange-place', 'grove-street', 'journal-square', 'journal-square-bus'].includes(profile.origin.stopId ?? '');

    const hasCustomStops = Boolean(profile.origin.stopId || profile.destination.stopId) &&
      !(['hoboken-terminal'].includes(profile.origin.stopId ?? '') && ['herald-square-subway', '33rd-street-path'].includes(profile.destination.stopId ?? '')) &&
      !(isJC && ['world-trade-center', 'fulton-st-subway', 'brookfield-ferry'].includes(profile.destination.stopId ?? ''));

    let rawCandidates: Omit<RouteCandidate, 'bufferMinutes' | 'riskScore'>[] = [];

    if (hasCustomStops) {
      rawCandidates = this.buildCustomCandidates(profile, snapshot);
    } else if (isJC) {
      rawCandidates = this.buildJCCorridorCandidates(profile, snapshot);
    } else {
      // Default / Golden Corridor: Hoboken to Midtown
      rawCandidates = this.buildHobokenMidtownCandidates(profile, snapshot);
    }

    // Filter by user's accepted transit modes
    const filteredCandidates = rawCandidates.filter((candidate) => {
      return candidate.legs.every((leg) => {
        if (leg.mode === 'bus' && leg.line.toLowerCase().includes('walk')) return true; // Walking is always acceptable
        return profile.acceptedModes.includes(leg.mode);
      });
    });

    // If filtering eliminates all, fall back to unfiltered to guarantee candidates
    const workingSet = filteredCandidates.length >= 2 ? filteredCandidates : rawCandidates;

    // Score each candidate with deterministic journey-risk math
    const scoredCandidates: RouteCandidate[] = workingSet.map((cand) => {
      const { bufferMinutes, riskScore } = RiskScorer.calculateBufferMinutes(
        cand,
        snapshot,
        profile.preferences.riskTolerance
      );

      // Recompute departure time based on arriveByTime and total lead time
      const { leaveByTime } = RiskScorer.computeLeaveByTime(
        profile.arriveByTime,
        cand.totalDurationMinutes,
        bufferMinutes
      );

      // The user-selected departure is the actual planning time. If an older
      // saved profile has no departure time, preserve the previous arrive-by
      // behavior by falling back to the computed safe leave-by time.
      const requestedDeparture = profile.departAtTime || leaveByTime;
      const scheduleOffset = timeToMinutes(requestedDeparture) - timeToMinutes(cand.departureTime);
      const legs = cand.legs.map((leg) => ({
        ...leg,
        departureTime: addMinutes(leg.departureTime, scheduleOffset),
        arrivalTime: addMinutes(leg.arrivalTime, scheduleOffset),
      }));

      const arrivalTime = addMinutes(requestedDeparture, cand.totalDurationMinutes);
      const isFeasible = timeToMinutes(arrivalTime) <= timeToMinutes(profile.arriveByTime);

      return {
        ...cand,
        departureTime: requestedDeparture,
        arrivalTime,
        legs,
        bufferMinutes,
        riskScore,
        isFeasible,
        feasibilityReason: isFeasible
          ? `Leaving at ${requestedDeparture} arrives by ${arrivalTime}, before the ${profile.arriveByTime} target.`
          : `Leaving at ${requestedDeparture} arrives at ${arrivalTime}, after the ${profile.arriveByTime} target. Leave by ${leaveByTime} to make the target.`,
      };
    });

    // Sort by risk score ascending (safest first), but penalize suspended lines to the end
    return scoredCandidates.sort((a, b) => {
      if (a.isFeasible !== b.isFeasible) return a.isFeasible ? -1 : 1;
      const aSuspended = a.legs.some((l) => l.delayMinutes >= 999);
      const bSuspended = b.legs.some((l) => l.delayMinutes >= 999);
      if (aSuspended && !bSuspended) return 1;
      if (!aSuspended && bSuspended) return -1;
      return a.riskScore - b.riskScore;
    });
  }

  /**
   * Selects the Primary Route and guarantees Plan B uses a different line or mode
   */
  public static selectPrimaryAndPlanB(
    candidates: RouteCandidate[]
  ): { primaryRoute: RouteCandidate; planBRoute?: RouteCandidate } {
    if (candidates.length === 0) {
      throw new Error('No candidate routes available for corridor.');
    }

    const primaryRoute = candidates[0];

    // Find first distinct candidate whose primary transit mode or line differs
    const primaryLine = primaryRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.line || '';
    const primaryMode = primaryRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.mode;

    const planBCandidate = candidates.slice(1).find((cand) => {
      const candLine = cand.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.line || '';
      const candMode = cand.legs.find((l) => !l.line.toLowerCase().includes('walk'))?.mode;
      const notSuspended = !cand.legs.some((l) => l.delayMinutes >= 999);

      // Plan B must NOT be the exact same line and must not be suspended
      return notSuspended && (candLine !== primaryLine || candMode !== primaryMode);
    });

    const planBRoute = planBCandidate ? { ...planBCandidate, isPlanB: true } : undefined;

    return { primaryRoute, planBRoute };
  }

  // --- Corridor Builders ---

  private static buildCustomCandidates(
    profile: CommuteProfile,
    snapshot: FeedSnapshot
  ): Omit<RouteCandidate, 'bufferMinutes' | 'riskScore'>[] {
    const origin = profile.origin.coordinates ?? [-74.0289, 40.7357];
    const destination = profile.destination.coordinates ?? [-73.9876, 40.7495];
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latDistance = toRadians(destination[1] - origin[1]);
    const lngDistance = toRadians(destination[0] - origin[0]);
    const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(
      Math.sin(latDistance / 2) ** 2 +
      Math.cos(toRadians(origin[1])) * Math.cos(toRadians(destination[1])) * Math.sin(lngDistance / 2) ** 2
    ));
    const baseDuration = Math.max(8, Math.round((distanceKm / 30) * 60 + 6));
    const originMode = profile.origin.mode ?? profile.acceptedModes.find((mode) => mode !== 'driving') ?? 'rail';
    const destinationMode = profile.destination.mode ?? originMode;
    const originService = serviceLabel(originMode, profile.origin.agency);
    const destinationService = serviceLabel(destinationMode, profile.destination.agency);
    const sameService = originMode === destinationMode && normalizeAgency(profile.origin.agency) === normalizeAgency(profile.destination.agency);
    const originReliability = snapshot.reliabilityOtp[profile.origin.stopId ?? 'custom'] ?? 90;
    const destinationReliability = snapshot.reliabilityOtp[profile.destination.stopId ?? 'custom'] ?? 88;

    // A station's selected agency/mode is authoritative. This prevents a LIRR → LIRR
    // journey from being mislabeled PATH simply because PATH is first in acceptedModes.
    if (sameService) {
      const directLine = `${originService} · ${profile.origin.name} → ${profile.destination.name}`;
      return [{
        id: `custom-direct-${originMode}`,
        name: `${originService} direct`,
        summary: `${profile.origin.name} → ${profile.destination.name}`,
        departureTime: '08:00',
        arrivalTime: '08:00',
        totalDurationMinutes: baseDuration,
        transfersCount: 0,
        estimatedCost: fareForMode(originMode),
        reliabilityRate: originReliability,
        legs: [buildLeg({
          id: `custom-direct-leg-${originMode}`,
          mode: originMode,
          line: directLine,
          lineColor: colorForMode(originMode),
          fromName: profile.origin.name,
          toName: profile.destination.name,
          departureTime: '08:00',
          arrivalTime: addMinutes('08:00', baseDuration),
          durationMinutes: baseDuration,
          delayMinutes: 0,
          statusText: `${originService} schedule estimate from selected stops`,
          coordinates: [origin, destination],
        })],
      }];
    }

    const firstDuration = Math.max(5, Math.round(baseDuration * 0.55));
    const transferBuffer = 5;
    const secondDuration = Math.max(5, baseDuration - firstDuration);
    const transferName = chooseTransferStation(profile, originService, destinationService);
    const transferCoordinate: [number, number] = [
      (origin[0] + destination[0]) / 2,
      (origin[1] + destination[1]) / 2,
    ];
    const secondDeparture = addMinutes('08:00', firstDuration + transferBuffer);
    const transferRoute = {
      id: `custom-transfer-${originMode}-${destinationMode}`,
      name: `${originService} → ${destinationService}`,
      summary: `${profile.origin.name} → ${transferName} → ${profile.destination.name}`,
      departureTime: '08:00',
      arrivalTime: addMinutes(secondDeparture, secondDuration),
      totalDurationMinutes: firstDuration + transferBuffer + secondDuration,
      transfersCount: 1,
      estimatedCost: fareForMode(originMode) + (originMode === destinationMode ? 0 : fareForMode(destinationMode)),
      reliabilityRate: Math.round((originReliability + destinationReliability) / 2),
      legs: [
        buildLeg({
          id: `custom-transfer-leg-1-${originMode}`,
          mode: originMode,
          line: originService,
          lineColor: colorForMode(originMode),
          fromName: profile.origin.name,
          toName: transferName,
          departureTime: '08:00',
          arrivalTime: addMinutes('08:00', firstDuration),
          durationMinutes: firstDuration,
          delayMinutes: 0,
          statusText: `${originService} leg · estimated from selected stops`,
          coordinates: [origin, transferCoordinate],
        }),
        buildLeg({
          id: `custom-transfer-walk-${originMode}-${destinationMode}`,
          mode: 'bus',
          line: 'Transfer / Walk',
          lineColor: '#94a3b8',
          fromName: transferName,
          toName: `${transferName} connection`,
          departureTime: addMinutes('08:00', firstDuration),
          arrivalTime: secondDeparture,
          durationMinutes: transferBuffer,
          delayMinutes: 0,
          statusText: 'Protected transfer buffer',
        }),
        buildLeg({
          id: `custom-transfer-leg-2-${destinationMode}`,
          mode: destinationMode,
          line: destinationService,
          lineColor: colorForMode(destinationMode),
          fromName: transferName,
          toName: profile.destination.name,
          departureTime: secondDeparture,
          arrivalTime: addMinutes(secondDeparture, secondDuration),
          durationMinutes: secondDuration,
          delayMinutes: 0,
          statusText: `${destinationService} leg · estimated from selected stops`,
          coordinates: [transferCoordinate, destination],
        }),
      ],
    };

    return [transferRoute];
  }

  private static buildHobokenMidtownCandidates(
    profile: CommuteProfile,
    snapshot: FeedSnapshot
  ): Omit<RouteCandidate, 'bufferMinutes' | 'riskScore'>[] {
    const pathDelay = snapshot.realtimeDelayMinutes['PATH_HOB_33'] ?? 0;
    const njtDelay = snapshot.realtimeDelayMinutes['NJT_MORRIS_ESSEX'] ?? 0;
    const ferryDelay = snapshot.realtimeDelayMinutes['FERRY_HOB_MID'] ?? 0;
    const busDelay = snapshot.realtimeDelayMinutes['NJT_BUS_126'] ?? 0;
    const tunnel = snapshot.trafficTunnels?.lincolnTunnel;

    const candidates: Omit<RouteCandidate, 'bufferMinutes' | 'riskScore'>[] = [];

    // 1. PATH Direct to 33rd St
    const pathDuration = 20 + (pathDelay >= 999 ? 0 : pathDelay);
    candidates.push({
      id: 'candidate-path-33',
      name: pathDelay >= 999 
        ? 'PATH Direct (Suspended)' 
        : pathDelay > 0 
          ? 'PATH Direct to 33rd St (Congested)' 
          : 'PATH Direct to 33rd St',
      summary: 'Hoboken Terminal → 33rd St Station + Walk to Herald Sq',
      departureTime: '08:14',
      arrivalTime: '08:39',
      totalDurationMinutes: pathDuration + 5,
      transfersCount: 0,
      estimatedCost: 2.75,
      reliabilityRate: snapshot.reliabilityOtp['PATH_HOB_33'] ?? 92,
      legs: [
        {
          id: 'leg-path-1',
          mode: 'path',
          line: 'PATH (HOB-33)',
          lineColor: '#0284c7',
          fromName: 'Hoboken Terminal',
          toName: '33rd Street Station',
          departureTime: '08:14',
          arrivalTime: '08:34',
          durationMinutes: pathDuration,
          delayMinutes: pathDelay,
          statusText: pathDelay >= 999 
            ? 'Service Suspended' 
            : pathDelay > 0 
              ? `+${pathDelay}m signal delay` 
              : 'On time (every 4 min)',
        },
        {
          id: 'leg-path-walk',
          mode: 'bus',
          line: 'Walk',
          fromName: '33rd Street Station',
          toName: 'Herald Sq / 34th St',
          departureTime: '08:34',
          arrivalTime: '08:39',
          durationMinutes: 5,
          delayMinutes: 0,
        },
      ],
    });

    // 2. NY Waterway Ferry (14th St Pier to Midtown W 39th St)
    candidates.push({
      id: 'candidate-ferry-midtown',
      name: 'NY Waterway Ferry',
      summary: 'Hoboken 14th St Pier → Midtown W 39th St + Shuttle',
      departureTime: '08:18',
      arrivalTime: '08:48',
      totalDurationMinutes: 10 + 12 + 10,
      transfersCount: 1,
      estimatedCost: 9.00,
      reliabilityRate: snapshot.reliabilityOtp['FERRY_HOB_MID'] ?? 98,
      legs: [
        {
          id: 'leg-ferry-access',
          mode: 'bus',
          line: 'Walk / Uptown Bus',
          fromName: 'Hoboken Terminal Area',
          toName: '14th St Ferry Pier',
          departureTime: '08:18',
          arrivalTime: '08:28',
          durationMinutes: 10,
          delayMinutes: 0,
        },
        {
          id: 'leg-ferry-sail',
          mode: 'ferry',
          line: 'NY Waterway Ferry',
          lineColor: '#0d9488',
          fromName: 'Hoboken 14th St Pier',
          toName: 'Midtown / W 39th St',
          departureTime: '08:28',
          arrivalTime: '08:40',
          durationMinutes: 12,
          delayMinutes: ferryDelay,
          statusText: 'Operating normal river crossings',
        },
        {
          id: 'leg-ferry-shuttle',
          mode: 'bus',
          line: 'Midtown Free Shuttle',
          lineColor: '#8b5cf6',
          fromName: 'W 39th Ferry Terminal',
          toName: 'Herald Sq',
          departureTime: '08:40',
          arrivalTime: '08:50',
          durationMinutes: 10,
          delayMinutes: 0,
        },
      ],
    });

    // 3. NJ Transit Rail via Secaucus into NY Penn
    candidates.push({
      id: 'candidate-njt-rail',
      name: 'NJ Transit Rail to NY Penn',
      summary: 'Hoboken Terminal → Secaucus Junction → NY Penn Station',
      departureTime: '08:10',
      arrivalTime: '08:44',
      totalDurationMinutes: 14 + 6 + 12 + 4,
      transfersCount: 1,
      estimatedCost: 6.50,
      reliabilityRate: snapshot.reliabilityOtp['NJT_MORRIS_ESSEX'] ?? 88,
      legs: [
        {
          id: 'leg-njt-1',
          mode: 'rail',
          line: 'NJT Morris & Essex',
          lineColor: '#e11d48',
          fromName: 'Hoboken Terminal',
          toName: 'Secaucus Junction',
          departureTime: '08:10',
          arrivalTime: '08:24',
          durationMinutes: 14,
          delayMinutes: njtDelay,
          statusText: njtDelay > 0 ? `+${njtDelay}m delay` : 'On time',
        },
        {
          id: 'leg-njt-2',
          mode: 'rail',
          line: 'Northeast Corridor Line',
          lineColor: '#e11d48',
          fromName: 'Secaucus Junction',
          toName: 'NY Penn Station',
          departureTime: '08:28',
          arrivalTime: '08:40',
          durationMinutes: 12,
          delayMinutes: 0,
          statusText: 'Penn Station connection',
        },
        {
          id: 'leg-njt-walk',
          mode: 'bus',
          line: 'Walk',
          fromName: 'NY Penn Station',
          toName: 'Herald Sq',
          departureTime: '08:40',
          arrivalTime: '08:44',
          durationMinutes: 4,
          delayMinutes: 0,
        },
      ],
    });

    // 4. NJ Transit 126 Bus to Port Authority Bus Terminal (PABT)
    const busDuration = 28 + busDelay + (tunnel ? tunnel.delayVsTypicalMinutes : 0);
    candidates.push({
      id: 'candidate-bus-126',
      name: 'NJ Transit 126 Bus to PABT',
      summary: 'Washington St → Lincoln Tunnel → Port Authority Bus Terminal',
      departureTime: '08:08',
      arrivalTime: '08:46',
      totalDurationMinutes: busDuration + 8,
      transfersCount: 0,
      estimatedCost: 3.50,
      reliabilityRate: snapshot.reliabilityOtp['NJT_BUS_126'] ?? 82,
      legs: [
        {
          id: 'leg-bus-126-main',
          mode: 'bus',
          line: 'NJT Bus 126',
          lineColor: '#8b5cf6',
          fromName: 'Hoboken Washington & 8th St',
          toName: 'Port Authority Bus Terminal',
          departureTime: '08:08',
          arrivalTime: '08:38',
          durationMinutes: busDuration,
          delayMinutes: busDelay,
          statusText: tunnel && tunnel.delayVsTypicalMinutes > 0 
            ? `Lincoln Tunnel +${tunnel.delayVsTypicalMinutes}m delay` 
            : 'Tunnel traffic normal',
        },
        {
          id: 'leg-bus-walk',
          mode: 'bus',
          line: 'Walk',
          fromName: 'PABT (8th Ave)',
          toName: 'Herald Sq',
          departureTime: '08:38',
          arrivalTime: '08:46',
          durationMinutes: 8,
          delayMinutes: 0,
        },
      ],
    });

    // 5. Driving option if enabled
    if (profile.preferences.allowDriving && tunnel) {
      candidates.push({
        id: 'candidate-driving-lincoln',
        name: 'Driving via Lincoln Tunnel',
        summary: 'Hoboken → Lincoln Tunnel → Midtown Garage',
        departureTime: '08:15',
        arrivalTime: '08:49',
        totalDurationMinutes: tunnel.travelTimeMinutes + 10,
        transfersCount: 0,
        estimatedCost: tunnel.tollAmount + 25.0, // Toll + NYC parking estimate
        reliabilityRate: 75,
        legs: [
          {
            id: 'leg-drive-car',
            mode: 'driving',
            line: 'Lincoln Tunnel Driving',
            lineColor: '#f97316',
            fromName: 'Hoboken',
            toName: 'Midtown 34th St Garage',
            departureTime: '08:15',
            arrivalTime: '08:39',
            durationMinutes: tunnel.travelTimeMinutes,
            delayMinutes: tunnel.delayVsTypicalMinutes,
            statusText: `$${tunnel.tollAmount.toFixed(2)} toll`,
          },
        ],
      });
    }

    return candidates;
  }

  private static buildJCCorridorCandidates(
    profile: CommuteProfile,
    snapshot: FeedSnapshot
  ): Omit<RouteCandidate, 'bufferMinutes' | 'riskScore'>[] {
    const pathDelay = snapshot.realtimeDelayMinutes['PATH_NWK_WTC'] ?? 0;
    const ferryDelay = snapshot.realtimeDelayMinutes['FERRY_PAULUS_BPC'] ?? 0;

    return [
      {
        id: 'candidate-path-wtc',
        name: 'PATH Direct to WTC',
        summary: 'Exchange Place → World Trade Center',
        departureTime: '08:25',
        arrivalTime: '08:33',
        totalDurationMinutes: 4 + 4,
        transfersCount: 0,
        estimatedCost: 2.75,
        reliabilityRate: snapshot.reliabilityOtp['PATH_NWK_WTC'] ?? 96,
        legs: [
          {
            id: 'leg-jc-path',
            mode: 'path',
            line: 'PATH (NWK-WTC)',
            lineColor: '#0284c7',
            fromName: 'Exchange Place Station',
            toName: 'World Trade Center',
            departureTime: '08:25',
            arrivalTime: '08:29',
            durationMinutes: 4 + pathDelay,
            delayMinutes: pathDelay,
            statusText: 'Trans-Hudson tunnel on time',
          },
          {
            id: 'leg-jc-walk',
            mode: 'bus',
            line: 'Walk (Oculus)',
            fromName: 'WTC Oculus',
            toName: 'Financial District Office',
            departureTime: '08:29',
            arrivalTime: '08:33',
            durationMinutes: 4,
            delayMinutes: 0,
          },
        ],
      },
      {
        id: 'candidate-ferry-bpc',
        name: 'NY Waterway Ferry (Paulus Hook)',
        summary: 'Paulus Hook Pier → Brookfield Place Ferry Terminal',
        departureTime: '08:20',
        arrivalTime: '08:33',
        totalDurationMinutes: 8 + 5,
        transfersCount: 0,
        estimatedCost: 8.00,
        reliabilityRate: snapshot.reliabilityOtp['FERRY_PAULUS_BPC'] ?? 99,
        legs: [
          {
            id: 'leg-jc-ferry',
            mode: 'ferry',
            line: 'NY Waterway Ferry',
            lineColor: '#0d9488',
            fromName: 'Paulus Hook Pier',
            toName: 'Brookfield Place',
            departureTime: '08:20',
            arrivalTime: '08:28',
            durationMinutes: 8,
            delayMinutes: ferryDelay,
            statusText: 'Cross-river ferry on time',
          },
          {
            id: 'leg-jc-ferry-walk',
            mode: 'bus',
            line: 'Walk',
            fromName: 'Brookfield Place',
            toName: 'Financial District Office',
            departureTime: '08:28',
            arrivalTime: '08:33',
            durationMinutes: 5,
            delayMinutes: 0,
          },
        ],
      },
    ];
  }
}
