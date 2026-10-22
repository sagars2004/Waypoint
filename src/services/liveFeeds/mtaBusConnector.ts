export interface MtaBusDelayInfo {
  lineRef: string;
  delayMinutes: number;
  activeVehicles: number;
  lastUpdated: string;
}

export async function fetchMtaBusStatus(lineRef: string = 'MTA NYCT_M34-SBS'): Promise<MtaBusDelayInfo | null> {
  const apiKey = process.env.MTA_BUS_TIME_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `http://bustime.mta.info/api/siri/vehicle-monitoring.json?key=${apiKey}&LineRef=${encodeURIComponent(lineRef)}&VehicleMonitoringDetailLevel=basic`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`MTA Bus Time API returned ${res.status}`);

    const data = await res.json();
    const delivery = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0];
    const activities = delivery?.VehicleActivity || [];

    // Calculate average delay if present in monitored call
    let totalDelaySec = 0;
    let delayCount = 0;

    for (const act of activities) {
      const delay = act?.MonitoredVehicleJourney?.Delay;
      if (delay) {
        // Delay is ISO 8601 duration e.g. "PT2M30S" or seconds
        const match = delay.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        if (match) {
          const mins = parseInt(match[1] || '0', 10);
          const secs = parseInt(match[2] || '0', 10);
          totalDelaySec += mins * 60 + secs;
          delayCount++;
        }
      }
    }

    const avgDelayMinutes = delayCount > 0 ? Math.round(totalDelaySec / delayCount / 60) : 0;

    return {
      lineRef,
      delayMinutes: avgDelayMinutes,
      activeVehicles: activities.length,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('MTA Bus Time API fetch error:', err);
    return null;
  }
}
