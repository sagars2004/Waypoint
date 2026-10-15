import { describe, it, expect } from 'vitest';
import { feedManager } from '@/services/feedManager';
import { FeedSnapshotSchema } from '@/types/schemas';

describe('FeedManager & Golden Replay Engine', () => {
  it('loads and validates all replay snapshots against strict Zod schema', () => {
    const scenarios = ['normal', 'delay', 'reroute', 'jc_normal', 'outage'] as const;

    scenarios.forEach((s) => {
      const snapshot = feedManager.getSnapshot(s);
      expect(snapshot).toBeDefined();
      expect(() => FeedSnapshotSchema.parse(snapshot)).not.toThrow();
    });
  });

  it('correctly reads real-time delay minutes for normal vs delay vs suspension', () => {
    const normal = feedManager.getSnapshot('normal');
    expect(feedManager.getLineDelay('PATH_HOB_33', normal)).toBe(0);

    const delay = feedManager.getSnapshot('delay');
    expect(feedManager.getLineDelay('PATH_HOB_33', delay)).toBe(9);

    const reroute = feedManager.getSnapshot('reroute');
    expect(feedManager.getLineDelay('PATH_HOB_33', reroute)).toBe(999);
  });

  it('extracts active alerts matching affected transit lines', () => {
    const delay = feedManager.getSnapshot('delay');
    const alerts = feedManager.getAlertsForLines(['PATH', 'HOB-33'], delay);

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].title).toContain('Signal Malfunction');
    expect(alerts[0].severity).toBe('moderate');
  });

  it('evaluates feed freshness status accurately according to PRD thresholds', () => {
    const normal = feedManager.getSnapshot('normal');
    const sources = feedManager.evaluateSources(normal);

    expect(sources.length).toBe(4);
    const pathSource = sources.find((s) => s.source === 'PATH GTFS-RT');
    expect(pathSource).toBeDefined();
    expect(pathSource?.status).toBe('fresh');
  });

  it('correctly flags offline status in degraded outage scenario (Feature F8)', () => {
    const outage = feedManager.getSnapshot('outage');
    const sources = feedManager.evaluateSources(outage);

    const njtSource = sources.find((s) => s.agency === 'NJ Transit');
    expect(njtSource).toBeDefined();
    expect(njtSource?.status).toBe('offline');
    expect(njtSource?.lastAgeSeconds).toBeGreaterThan(300);
  });
});
