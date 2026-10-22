import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { TransitAlert } from '@/types/schemas';

export interface NJTransitLiveStatus {
  railDelays: Record<string, number>; // line code -> delay minutes
  alerts: TransitAlert[];
  fetchedAt: string;
  sourceType: 'live_gtfs_rt' | 'developer_api' | 'fallback_cached';
}

export class NJTransitConnector {
  private static instance: NJTransitConnector;

  public static getInstance(): NJTransitConnector {
    if (!NJTransitConnector.instance) {
      NJTransitConnector.instance = new NJTransitConnector();
    }
    return NJTransitConnector.instance;
  }

  /**
   * Fetches real-time NJ Transit updates using API key or developer credentials
   */
  public async fetchLiveStatus(): Promise<NJTransitLiveStatus | null> {
    const apiKey = process.env.NJTRANSIT_API_KEY;
    const username = process.env.NJTRANSIT_USERNAME;
    const password = process.env.NJTRANSIT_PASSWORD;

    if (!apiKey && (!username || !password)) {
      return null;
    }

    try {
      // 1. Try GTFS-RT TripUpdates protobuf endpoint with API Key
      const headers: HeadersInit = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      // NJ Transit GTFS-RT feed url
      const gtfsUrl = 'https://content.njtransit.com/gtfs-rt/rail/tripupdates';
      const res = await fetch(gtfsUrl, {
        headers,
        next: { revalidate: 30 },
      });

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(buffer)
        );

        const railDelays: Record<string, number> = {};
        const alerts: TransitAlert[] = [];

        // Parse entities
        if (feed.entity && Array.isArray(feed.entity)) {
          for (const entity of feed.entity) {
            if (entity.tripUpdate?.stopTimeUpdate) {
              const routeId = entity.tripUpdate.trip?.routeId || 'NJT_RAIL';
              for (const stu of entity.tripUpdate.stopTimeUpdate) {
                const delaySec = stu.departure?.delay || stu.arrival?.delay || 0;
                const delayMin = Math.round(delaySec / 60);
                if (delayMin > (railDelays[routeId] || 0)) {
                  railDelays[routeId] = delayMin;
                }
              }
            }

            if (entity.alert) {
              alerts.push({
                id: entity.id || `njt-alert-${Date.now()}`,
                agency: 'NJ Transit',
                line: entity.alert.informedEntity?.[0]?.routeId || 'Rail Network',
                severity: 'moderate',
                title: entity.alert.headerText?.translation?.[0]?.text || 'NJ Transit Rail Alert',
                description: entity.alert.descriptionText?.translation?.[0]?.text || 'Service alert reported',
                timestamp: 'Live',
              });
            }
          }
        }

        return {
          railDelays,
          alerts,
          fetchedAt: new Date().toISOString(),
          sourceType: 'live_gtfs_rt',
        };
      }

      // If protobuf was unauthorized or unavailable, log status
      console.warn(`NJ Transit GTFS-RT returned status ${res.status}`);
      return null;
    } catch (err) {
      console.warn('Error fetching live NJ Transit data:', err);
      return null;
    }
  }
}

export const njTransitConnector = NJTransitConnector.getInstance();
