import { Dive } from '../types';
import { canonicalCountryKey } from './countries';

export type StatsRange = 'all' | 'year' | 'month';

// Timestamps follow the local time used by the dive form; date-only values
// must not shift to a different day through UTC parsing.
export function diveDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : new Date(NaN);
}

export function filterDives(dives: Dive[], range: StatsRange, now: Date): Dive[] {
  if (range === 'all') return dives;
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = range === 'year' ? new Date(year - 1, 0, 1) : new Date(year, month - 1, 1);
  const end = range === 'year' ? new Date(year, 0, 1) : new Date(year, month, 1);
  return dives.filter(dive => {
    const date = diveDate(dive.date);
    return date >= start && date < end;
  });
}

export function summarizeDives(dives: Dive[]) {
  let totalDepth = 0;
  let totalMinutes = 0;
  let deepestDive: Dive | null = null;
  let longestDive: Dive | null = null;
  const counts = new Map<string, number>();
  const countryLabels = new Map<string, string>();
  const recent: Dive[] = [];
  for (const dive of dives) {
    totalDepth += dive.maxDepth;
    totalMinutes += dive.duration;
    if (!deepestDive || dive.maxDepth > deepestDive.maxDepth) deepestDive = dive;
    if (!longestDive || dive.duration > longestDive.duration) longestDive = dive;
    const country = dive.country?.trim();
    if (country) {
      const key = canonicalCountryKey(country);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!countryLabels.has(key)) countryLabels.set(key, country);
    }
    if (Number.isFinite(diveDate(dive.date).getTime())) {
      recent.push(dive);
      recent.sort((a, b) => diveDate(a.date).getTime() - diveDate(b.date).getTime() || a.id - b.id);
      if (recent.length > 6) recent.shift();
    }
  }
  return {
    averageDepth: dives.length ? Math.round(totalDepth / dives.length) : 0,
    totalMinutes,
    deepestDive,
    longestDive,
    countries: [...counts.entries()].map(([key, count]): [string, number] => [countryLabels.get(key)!, count])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    recent,
    maxDuration: Math.max(1, ...recent.map(dive => dive.duration)),
  };
}

export function formatDiveTime(minutes: number): string {
  const rounded = Math.round(minutes);
  return rounded < 60 ? `${rounded} min` : `${Math.floor(rounded / 60)} h ${rounded % 60} min`;
}
