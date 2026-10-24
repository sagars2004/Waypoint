import { TransitMode } from '@/types/commute';
import { MTA_SUBWAY_STOPS } from '@/data/mtaSubwayStops';

export interface TransitStop {
  id: string;
  name: string;
  agency: string;
  mode: TransitMode;
  coordinates: [number, number];
  aliases: string[];
}

// Curated stops keep replay mode deterministic while leaving room for a live
// station-search connector later. Coordinates are [longitude, latitude].
export const TRANSIT_STOPS: TransitStop[] = [
  { id: 'hoboken-terminal', name: 'Hoboken Terminal', agency: 'NJ Transit', mode: 'rail', coordinates: [-74.0289, 40.7357], aliases: ['hoboken', 'nj transit'] },
  { id: 'journal-square', name: 'Journal Square Transportation Center', agency: 'PATH', mode: 'path', coordinates: [-74.06252, 40.73207], aliases: ['journal square', 'jsq', 'jersey city'] },
  { id: 'exchange-place', name: 'Exchange Place', agency: 'PATH', mode: 'path', coordinates: [-74.0336, 40.7168], aliases: ['exchange', 'jersey city'] },
  { id: 'grove-street', name: 'Grove Street', agency: 'PATH', mode: 'path', coordinates: [-74.0436, 40.7193], aliases: ['grove', 'jersey city'] },
  { id: '33rd-street-path', name: '33rd Street PATH', agency: 'PATH', mode: 'path', coordinates: [-73.9880, 40.7505], aliases: ['33rd path', 'midtown'] },
  { id: 'world-trade-center', name: 'World Trade Center', agency: 'PATH', mode: 'path', coordinates: [-74.0090, 40.7126], aliases: ['wtc', 'oculus', 'lower manhattan'] },
  { id: 'newport-path', name: 'Newport', agency: 'PATH', mode: 'path', coordinates: [-74.0326, 40.7267], aliases: ['newport', 'newport path', 'jersey city'] },
  { id: 'christopher-st-path', name: 'Christopher St', agency: 'PATH', mode: 'path', coordinates: [-74.0029, 40.7334], aliases: ['christopher street', 'christopher path', 'greenwich village'] },
  { id: '9th-st-path', name: '9th St', agency: 'PATH', mode: 'path', coordinates: [-74.0085, 40.7342], aliases: ['9th street', '9 street path', 'west village'] },
  { id: '14th-st-path', name: '14th St', agency: 'PATH', mode: 'path', coordinates: [-74.0007, 40.7376], aliases: ['14th street', '14 street path', 'chelsea'] },
  { id: '23rd-st-path', name: '23rd St', agency: 'PATH', mode: 'path', coordinates: [-73.9981, 40.7428], aliases: ['23rd street', '23 street path', 'chelsea'] },
  { id: 'newark-penn', name: 'Newark Penn Station', agency: 'NJ Transit', mode: 'rail', coordinates: [-74.1649, 40.7347], aliases: ['newark penn', 'newark'] },
  { id: 'secaucus-junction', name: 'Secaucus Junction', agency: 'NJ Transit', mode: 'rail', coordinates: [-74.0750, 40.7600], aliases: ['secaucus', 'junction'] },
  { id: 'ny-penn', name: 'Moynihan Train Hall / NY Penn', agency: 'Amtrak', mode: 'rail', coordinates: [-73.9934, 40.7505], aliases: ['penn', 'moynihan', 'amtrak'] },
  { id: 'lirr-jamaica', name: 'Jamaica Station', agency: 'LIRR', mode: 'rail', coordinates: [-73.8089, 40.7003], aliases: ['jamaica', 'queens'] },
  { id: 'lirr-atlantic', name: 'Atlantic Terminal', agency: 'LIRR', mode: 'rail', coordinates: [-73.9772, 40.6844], aliases: ['atlantic terminal', 'brooklyn'] },
  { id: 'herald-square-subway', name: '34 St–Herald Sq', agency: 'MTA Subway', mode: 'rail', coordinates: [-73.9882, 40.7496], aliases: ['herald square', '34th street', 'subway'] },
  { id: 'times-square-subway', name: 'Times Sq–42 St', agency: 'MTA Subway', mode: 'rail', coordinates: [-73.9870, 40.7553], aliases: ['times square', '42nd street', 'subway'] },
  { id: 'fulton-st-subway', name: 'Fulton St', agency: 'MTA Subway', mode: 'rail', coordinates: [-74.0067, 40.7104], aliases: ['fulton', 'subway'] },
  { id: 'hoboken-washington-8th', name: 'Washington St & 8th St', agency: 'NJ Transit', mode: 'bus', coordinates: [-74.0294, 40.7385], aliases: ['126', 'washington street', 'hoboken bus'] },
  { id: 'pabt', name: 'Port Authority Bus Terminal', agency: 'NJ Transit', mode: 'bus', coordinates: [-73.9911, 40.7568], aliases: ['pabt', 'bus terminal', '42nd street'] },
  { id: 'journal-square-bus', name: 'Journal Square Bus Center', agency: 'NJ Transit', mode: 'bus', coordinates: [-74.06252, 40.73207], aliases: ['journal square bus', 'jsq bus'] },
  { id: 'hoboken-14th-ferry', name: 'Hoboken 14th St Ferry', agency: 'NY Waterway', mode: 'ferry', coordinates: [-74.0241, 40.7440], aliases: ['ferry', '14th street'] },
  { id: 'midtown-39th-ferry', name: 'W 39th St Ferry Terminal', agency: 'NY Waterway', mode: 'ferry', coordinates: [-74.0042, 40.7573], aliases: ['39th ferry', 'midtown ferry'] },
  { id: 'paulus-hook-ferry', name: 'Paulus Hook Ferry', agency: 'NY Waterway', mode: 'ferry', coordinates: [-74.0340, 40.7152], aliases: ['paulus hook', 'ferry'] },
  { id: 'brookfield-ferry', name: 'Brookfield Place Ferry', agency: 'NY Waterway', mode: 'ferry', coordinates: [-74.0157, 40.7148], aliases: ['brookfield', 'battery park ferry'] },
  ...MTA_SUBWAY_STOPS,
];

export function getTransitStop(id?: string): TransitStop | undefined {
  return TRANSIT_STOPS.find((stop) => stop.id === id);
}
