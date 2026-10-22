import { 
  FeedSnapshot, 
  FeedSnapshotSchema, 
  FeedSourceStatus, 
  TransitAlert 
} from '@/types/schemas';

import normalSnapshot from '@/data/replay/hoboken_midtown_normal.json';
import delaySnapshot from '@/data/replay/hoboken_midtown_delay.json';
import rerouteSnapshot from '@/data/replay/hoboken_midtown_reroute.json';
import jcNormalSnapshot from '@/data/replay/jc_wtc_normal.json';
import outageSnapshot from '@/data/replay/feed_outage_degraded.json';

export type ReplayScenarioKey = 'normal' | 'delay' | 'reroute' | 'outage' | 'jc_normal';

export class FeedManager {
  private static instance: FeedManager;
  private currentScenario: ReplayScenarioKey = 'normal';
  private snapshots: Record<ReplayScenarioKey, FeedSnapshot>;

  private constructor() {
    // Validate all snapshots against Zod schema at runtime initialization
    this.snapshots = {
      normal: FeedSnapshotSchema.parse(normalSnapshot),
      delay: FeedSnapshotSchema.parse(delaySnapshot),
      reroute: FeedSnapshotSchema.parse(rerouteSnapshot),
      jc_normal: FeedSnapshotSchema.parse(jcNormalSnapshot),
      outage: FeedSnapshotSchema.parse(outageSnapshot),
    };
  }

  public static getInstance(): FeedManager {
    if (!FeedManager.instance) {
      FeedManager.instance = new FeedManager();
    }
    return FeedManager.instance;
  }

  public setScenario(scenario: ReplayScenarioKey) {
    this.currentScenario = scenario;
  }

  public getCurrentScenario(): ReplayScenarioKey {
    return this.currentScenario;
  }

  public getSnapshot(scenarioKey?: ReplayScenarioKey): FeedSnapshot {
    const key = scenarioKey || this.currentScenario;
    const base = this.snapshots[key] || this.snapshots.normal;
    return structuredClone(base);
  }

  /**
   * Evaluates freshness and returns status for all connected transit data sources
   * Rules from PRD:
   * - Under 90s: fresh
   * - 90 to 300s: stale (downgrade confidence one level)
   * - Over 300s or outage: offline (visible warning banner)
   */
  public evaluateSources(snapshot: FeedSnapshot, simulatedNowMs?: number): FeedSourceStatus[] {
    const fetchedMs = new Date(snapshot.fetchedAt).getTime();
    const now = simulatedNowMs ?? fetchedMs;
    const elapsedSeconds = Math.max(0, Math.floor((now - fetchedMs) / 1000));

    const sources = [
      {
        source: 'PATH GTFS-RT',
        agency: 'Port Authority NYNJ',
        isDown: false,
        age: elapsedSeconds,
      },
      {
        source: 'NJ Transit Rail & Bus',
        agency: 'NJ Transit',
        isDown: snapshot.scenario === 'outage',
        age: snapshot.scenario === 'outage' ? Math.max(301, elapsedSeconds) : elapsedSeconds,
      },
      {
        source: 'NY Waterway Ferry',
        agency: 'NY Waterway',
        isDown: false,
        age: elapsedSeconds,
      },
      {
        source: 'NYC DOT Traffic',
        agency: 'NYC DOT',
        isDown: false,
        age: elapsedSeconds,
      },
    ];

    return sources.map((s) => {
      let status: 'fresh' | 'stale' | 'offline' = 'fresh';
      if (s.isDown || s.age > 300) {
        status = 'offline';
      } else if (s.age >= 90) {
        status = 'stale';
      }

      return {
        source: s.source,
        agency: s.agency,
        status,
        lastAgeSeconds: s.age,
        lastUpdated: new Date(Math.max(fetchedMs, now - s.age * 1000)).toISOString(),
      };
    });
  }

  /**
   * Retrieves real-time delay in minutes for a specific transit line
   */
  public getLineDelay(lineId: string, snapshot: FeedSnapshot): number {
    return snapshot.realtimeDelayMinutes[lineId] ?? 0;
  }

  /**
   * Retrieves historical on-time performance reliability rate (e.g., 94%)
   */
  public getLineReliability(lineId: string, snapshot: FeedSnapshot): number {
    return snapshot.reliabilityOtp[lineId] ?? 85;
  }

  /**
   * Returns alerts matching a set of active lines
   */
  public getAlertsForLines(lines: string[], snapshot: FeedSnapshot): TransitAlert[] {
    if (snapshot.alerts.length === 0) return [];
    return snapshot.alerts.filter((alert) => {
      return lines.some((line) => 
        alert.line.toLowerCase().includes(line.toLowerCase()) || 
        alert.agency.toLowerCase() === 'system'
      );
    });
  }

  /**
   * Returns vehicle traffic crossing delay and toll info
   */
  public getCrossingTraffic(crossingKey: 'lincolnTunnel' | 'hollandTunnel', snapshot: FeedSnapshot) {
    return snapshot.trafficTunnels?.[crossingKey] || null;
  }
}

export const feedManager = FeedManager.getInstance();
