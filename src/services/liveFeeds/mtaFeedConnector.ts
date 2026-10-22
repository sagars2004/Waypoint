import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { TransitAlert } from '@/types/schemas';

export type MTASubdivision = 'subway_numbered' | 'subway_ace' | 'subway_bdfm' | 'subway_nqrw' | 'lirr' | 'metro_north' | 'alerts';

export interface MTALiveStatus {
  delaysByLine: Record<string, number>;
  activeAlerts: TransitAlert[];
  fetchedAt: string;
}

export class MTAFeedConnector {
  private static instance: MTAFeedConnector;

  private endpoints: Record<MTASubdivision, string> = {
    subway_numbered: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
    subway_ace: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
    subway_bdfm: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
    subway_nqrw: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
    lirr: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr',
    metro_north: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr',
    alerts: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts',
  };

  public static getInstance(): MTAFeedConnector {
    if (!MTAFeedConnector.instance) {
      MTAFeedConnector.instance = new MTAFeedConnector();
    }
    return MTAFeedConnector.instance;
  }

  /**
   * Fetches and decodes real-time protobuf feeds for MTA Subways, LIRR, and Metro-North
   */
  public async fetchSubdivisionFeed(subdivision: MTASubdivision): Promise<MTALiveStatus | null> {
    const apiKey = process.env.MTA_SUBWAY_API_KEY || process.env.MTA_API_KEY;
    if (!apiKey) return null;

    const url = this.endpoints[subdivision];
    if (!url) return null;

    try {
      const res = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
        },
        next: { revalidate: 30 },
      });

      if (!res.ok) {
        console.warn(`MTA feed ${subdivision} returned status ${res.status}`);
        return null;
      }

      const buffer = await res.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
      );

      const delaysByLine: Record<string, number> = {};
      const activeAlerts: TransitAlert[] = [];

      if (feed.entity && Array.isArray(feed.entity)) {
        for (const entity of feed.entity) {
          if (entity.tripUpdate?.stopTimeUpdate) {
            const routeId = entity.tripUpdate.trip?.routeId || subdivision;
            for (const stu of entity.tripUpdate.stopTimeUpdate) {
              const delaySec = stu.departure?.delay || stu.arrival?.delay || 0;
              const delayMin = Math.round(delaySec / 60);
              if (delayMin > (delaysByLine[routeId] || 0)) {
                delaysByLine[routeId] = delayMin;
              }
            }
          }

          if (entity.alert) {
            activeAlerts.push({
              id: entity.id || `mta-alert-${Date.now()}`,
              agency: 'MTA',
              line: entity.alert.informedEntity?.[0]?.routeId || 'MTA Transit',
              severity: 'moderate',
              title: entity.alert.headerText?.translation?.[0]?.text || 'MTA Service Alert',
              description: entity.alert.descriptionText?.translation?.[0]?.text || 'MTA service adjustment reported',
              timestamp: 'Live MTA telemetry',
            });
          }
        }
      }

      return {
        delaysByLine,
        activeAlerts,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`Error decoding MTA ${subdivision} feed:`, err);
      return null;
    }
  }
}

export const mtaFeedConnector = MTAFeedConnector.getInstance();
