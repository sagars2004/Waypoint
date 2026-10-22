export interface LiveWeatherData {
  temperatureF: number;
  condition: string;
  isSevere: boolean;
  windSpeedMph: number;
}

export async function fetchLiveWeather(): Promise<LiveWeatherData> {
  try {
    // Open-Meteo free API for NYC/Hudson River (Hoboken / Manhattan area)
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7357&longitude=-74.0289&current=temperature_2m,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph';
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);

    const data = await res.json();
    const current = data.current;
    const temp = Math.round(current.temperature_2m ?? 65);
    const wind = Math.round(current.wind_speed_10m ?? 8);
    const precip = current.precipitation ?? 0;
    const code = current.weather_code ?? 0;

    // Severe if high wind (>25 mph) or heavy precipitation
    const isSevere = wind > 25 || precip > 0.5 || code >= 80;

    let condition = 'Clear';
    if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
    else if (code >= 51 && code <= 67) condition = 'Rain';
    else if (code >= 71) condition = 'Snow';
    else if (code >= 80) condition = 'Storm';

    return {
      temperatureF: temp,
      condition,
      isSevere,
      windSpeedMph: wind,
    };
  } catch (err) {
    console.warn('Weather fetch fallback to default:', err);
    return {
      temperatureF: 62,
      condition: 'Fair',
      isSevere: false,
      windSpeedMph: 9,
    };
  }
}
