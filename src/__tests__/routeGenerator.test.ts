import { describe, it, expect } from 'vitest';
import { RouteGenerator } from '@/services/routeGenerator';
import { RiskScorer } from '@/services/riskScorer';
import { feedManager } from '@/services/feedManager';
import { SAMPLE_PROFILES } from '@/data/mockCorridors';

describe('RouteGenerator & RiskScorer (Phase 3)', () => {
  const profile = SAMPLE_PROFILES[0]; // Hoboken to Midtown

  it('generates at least 3 distinct multimodal candidates for the demo corridor', () => {
    const normalSnapshot = feedManager.getSnapshot('normal');
    const candidates = RouteGenerator.generateCandidates(profile, normalSnapshot);

    expect(candidates.length).toBeGreaterThanOrEqual(3);
    const candidateNames = candidates.map((c) => c.name);
    expect(candidateNames.some((n) => n.includes('PATH'))).toBe(true);
    expect(candidateNames.some((n) => n.includes('Ferry'))).toBe(true);
  });

  it('guarantees Plan B uses a different transit line/mode from Primary', () => {
    const normalSnapshot = feedManager.getSnapshot('normal');
    const candidates = RouteGenerator.generateCandidates(profile, normalSnapshot);
    const { primaryRoute, planBRoute } = RouteGenerator.selectPrimaryAndPlanB(candidates);

    expect(primaryRoute).toBeDefined();
    expect(planBRoute).toBeDefined();

    const primaryMainLeg = primaryRoute.legs.find((l) => !l.line.toLowerCase().includes('walk'));
    const planBMainLeg = planBRoute?.legs.find((l) => !l.line.toLowerCase().includes('walk'));

    expect(primaryMainLeg?.line).not.toBe(planBMainLeg?.line);
    expect(planBRoute?.isPlanB).toBe(true);
  });

  it('calculates higher safety buffer for routes with lower reliability or transfers', () => {
    const normalSnapshot = feedManager.getSnapshot('normal');
    const candidates = RouteGenerator.generateCandidates(profile, normalSnapshot);

    const directPath = candidates.find((c) => c.id === 'candidate-path-33');
    const transferRail = candidates.find((c) => c.id === 'candidate-njt-rail');

    expect(directPath).toBeDefined();
    expect(transferRail).toBeDefined();
    // Direct PATH has 0 transfers & 94% reliability; NJT Rail has 1 transfer & 88% reliability
    expect(transferRail!.bufferMinutes).toBeGreaterThanOrEqual(directPath!.bufferMinutes);
  });

  it('promotes next best alternative to Primary when primary line is suspended (Reroute scenario)', () => {
    const rerouteSnapshot = feedManager.getSnapshot('reroute');
    const candidates = RouteGenerator.generateCandidates(profile, rerouteSnapshot);
    const { primaryRoute } = RouteGenerator.selectPrimaryAndPlanB(candidates);

    // Primary route must NOT be suspended
    expect(primaryRoute.legs.every((l) => l.delayMinutes < 999)).toBe(true);
    expect(primaryRoute.id).not.toBe('candidate-path-33');
    // Primary should be Ferry or Rail
    expect(primaryRoute.legs.some((l) => l.mode === 'ferry' || l.mode === 'rail' || l.mode === 'bus')).toBe(true);
  });

  it('evaluates verdict states correctly across scenarios', () => {
    // Normal
    const normalSnapshot = feedManager.getSnapshot('normal');
    const normalCandidates = RouteGenerator.generateCandidates(profile, normalSnapshot);
    const normalState = RiskScorer.evaluateVerdictState(normalCandidates[0], normalCandidates, normalSnapshot);
    expect(normalState).toBe('comfortable');

    // Delay
    const delaySnapshot = feedManager.getSnapshot('delay');
    const delayCandidates = RouteGenerator.generateCandidates(profile, delaySnapshot);
    // PATH with 9m delay has elevated risk
    const pathDelayed = delayCandidates.find((c) => c.id === 'candidate-path-33');
    expect(pathDelayed).toBeDefined();
    const delayState = RiskScorer.evaluateVerdictState(pathDelayed!, delayCandidates, delaySnapshot);
    expect(delayState).toBe('tight');

    // Reroute
    const rerouteSnapshot = feedManager.getSnapshot('reroute');
    const rerouteCandidates = RouteGenerator.generateCandidates(profile, rerouteSnapshot);
    const rerouteState = RiskScorer.evaluateVerdictState(rerouteCandidates[0], rerouteCandidates, rerouteSnapshot);
    expect(rerouteState).toBe('reroute');
  });

  it('computes accurate leave-by times subtracting total lead minutes from target arrive-by', () => {
    // Arrive by 09:00, duration 25m, buffer 15m => 40m total => 08:20 AM leave
    const result = RiskScorer.computeLeaveByTime('09:00', 25, 15);
    expect(result.leaveByTime).toBe('08:20');
    expect(result.totalLeadMinutes).toBe(40);
  });

  it('uses the selected station agency for LIRR-to-LIRR routes', () => {
    const normalSnapshot = feedManager.getSnapshot('normal');
    const lirrProfile = {
      ...profile,
      id: 'custom-lirr',
      origin: { name: 'Jamaica Station', stopId: 'lirr-jamaica', agency: 'LIRR', mode: 'rail' as const, coordinates: [-73.8089, 40.7003] as [number, number] },
      destination: { name: 'Atlantic Terminal', stopId: 'lirr-atlantic', agency: 'LIRR', mode: 'rail' as const, coordinates: [-73.9772, 40.6844] as [number, number] },
    };

    const candidates = RouteGenerator.generateCandidates(lirrProfile, normalSnapshot);
    expect(candidates[0].legs[0].line).toContain('LIRR');
    expect(candidates[0].legs[0].line).not.toContain('PATH');
  });

  it('models a cross-agency trip as ordered legs with a protected transfer', () => {
    const normalSnapshot = feedManager.getSnapshot('normal');
    const multimodalProfile = {
      ...profile,
      id: 'custom-path-subway',
      origin: { name: 'Exchange Place', stopId: 'exchange-place', agency: 'PATH', mode: 'path' as const, coordinates: [-74.0336, 40.7168] as [number, number] },
      destination: { name: 'Times Sq–42 St', stopId: 'times-square-subway', agency: 'MTA Subway', mode: 'rail' as const, coordinates: [-73.9870, 40.7553] as [number, number] },
    };

    const candidates = RouteGenerator.generateCandidates(multimodalProfile, normalSnapshot);
    expect(candidates[0].legs.length).toBeGreaterThanOrEqual(3);
    expect(candidates[0].transfersCount).toBe(1);
    expect(candidates[0].legs[0].line).toContain('PATH');
    expect(candidates[0].legs.at(-1)?.line).toContain('MTA Subway');
  });
});
