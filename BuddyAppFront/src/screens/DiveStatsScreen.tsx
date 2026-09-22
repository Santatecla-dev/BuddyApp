import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import API from '../api/api';
import { Dive } from '../types';

type Range = 'all' | 'year' | 'month';

export default function DiveStatsScreen() {
  const [dives, setDives] = useState<Dive[]>([]);
  const [range, setRange] = useState<Range>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/dives/my')
      .then((response) => setDives(response.data))
      .catch(() => setDives([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleDives = useMemo(() => {
    if (range === 'all') return dives;
    const since = new Date();
    if (range === 'year') since.setFullYear(since.getFullYear() - 1);
    if (range === 'month') since.setMonth(since.getMonth() - 1);
    return dives.filter((dive) => new Date(dive.date) >= since);
  }, [dives, range]);

  const averageDepth = visibleDives.length
    ? Math.round(visibleDives.reduce((sum, dive) => sum + dive.maxDepth, 0) / visibleDives.length)
    : 0;
  const totalMinutes = visibleDives.reduce((sum, dive) => sum + dive.duration, 0);
  const countries = useMemo(() => {
    const values: Record<string, number> = {};
    visibleDives.forEach((dive) => { values[dive.country] = (values[dive.country] || 0) + 1; });
    return Object.entries(values).sort((a, b) => b[1] - a[1]);
  }, [visibleDives]);

  const recent = [...visibleDives]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-6);
  const maxDuration = Math.max(...recent.map((dive) => dive.duration), 1);
  const deepestDive = visibleDives.length ? [...visibleDives].sort((a, b) => b.maxDepth - a.maxDepth)[0] : null;
  const longestDive = visibleDives.length ? [...visibleDives].sort((a, b) => b.duration - a.duration)[0] : null;
  const topCountry = countries[0]?.[0] || 'No country yet';

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#0077CC" /><Text style={styles.loadingText}>Loading statistics…</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Dive statistics</Text>
          <Text style={styles.subtitle}>A summary of your logbook</Text>
        </View>
        <Text style={styles.periodText}>{range === 'all' ? 'All time' : range === 'year' ? 'Last year' : 'Last month'}</Text>
      </View>

      <View style={[styles.rangeRow, Platform.OS === 'web' && styles.webRangeRow]}>
        {([['all', 'All time'], ['year', 'Last year'], ['month', 'Last month']] as [Range, string][]).map(([value, label]) => (
          <TouchableOpacity key={value} style={[styles.rangeButton, range === value && styles.rangeButtonActive]} onPress={() => setRange(value)}>
            <Text style={[styles.rangeText, range === value && styles.rangeTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.summaryGrid, Platform.OS === 'web' && styles.webSummaryGrid]}>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Dives</Text><Text style={styles.summaryValue}>{visibleDives.length}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Average depth</Text><Text style={styles.summaryValue}>{averageDepth} m</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Time underwater</Text><Text style={styles.summaryValue}>{Math.round(totalMinutes / 60)} h</Text></View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Dive duration</Text>
        {recent.length ? (
          <View style={[styles.chart, Platform.OS === 'web' && styles.webChart]}>
            <View style={styles.chartBaseline} />
            {recent.map((dive) => (
              <View key={dive.id} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${Math.max(12, (dive.duration / maxDuration) * 100)}%` }]} />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>{new Date(dive.date).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={styles.emptyText}>No dives in this period.</Text>}
      </View>

      <View style={[styles.panel, Platform.OS === 'web' && styles.webHighlightPanel]}>
        <Text style={styles.panelTitle}>Highlights</Text>
        <View style={[styles.highlightViewport, Platform.OS === 'web' && styles.webHighlightViewport]}>
          <View style={[styles.highlightRow, Platform.OS === 'web' && styles.webHighlightRow]}>
            <View style={[styles.highlightCard, Platform.OS === 'web' && styles.webHighlightCardFirst]}>
              <Text style={styles.highlightKicker}>DEEPEST DIVE</Text>
              <Text style={styles.highlightValue}>{deepestDive ? `${deepestDive.maxDepth} m` : '—'}</Text>
              <Text style={styles.highlightText} numberOfLines={1}>{deepestDive?.location || 'No dives yet'}</Text>
            </View>
            <View style={[styles.highlightCard, Platform.OS === 'web' && styles.webHighlightCardOverlap]}>
              <Text style={styles.highlightKicker}>LONGEST DIVE</Text>
              <Text style={styles.highlightValue}>{longestDive ? `${longestDive.duration} min` : '—'}</Text>
              <Text style={styles.highlightText} numberOfLines={1}>{longestDive?.location || 'No dives yet'}</Text>
            </View>
            <View style={[styles.highlightCard, Platform.OS === 'web' && styles.webHighlightCardLast]}>
              <Text style={styles.highlightKicker}>TOP COUNTRY</Text>
              <Text style={styles.highlightValue}>{countries.length ? countries[0][1] : '—'}</Text>
              <Text style={styles.highlightText} numberOfLines={1}>{topCountry}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Countries visited</Text>
        {countries.length ? countries.map(([country, count]) => (
          <View key={country} style={[styles.countryRow, Platform.OS === 'web' && styles.webCountryRow]}>
            <Text style={styles.countryName} numberOfLines={1}>{country}</Text>
            <View style={styles.countryTrack}><View style={[styles.countryBar, { width: `${(count / countries[0][1]) * 100}%` }]} /></View>
            <Text style={styles.countryCount}>{count}</Text>
          </View>
        )) : <Text style={styles.emptyText}>No countries to display.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f9fc' },
  loadingText: { color: '#555', marginTop: 12 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  headingCopy: { flex: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0077CC' },
  subtitle: { fontSize: 15, color: '#555', marginTop: 4 },
  periodText: { color: '#00A8A8', fontWeight: 'bold', marginBottom: 4 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  webRangeRow: { width: 600, flexWrap: 'nowrap' },
  rangeButton: { backgroundColor: 'white', borderColor: '#b8d8ee', borderWidth: 1, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10 },
  rangeButtonActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  rangeText: { color: '#0077CC', fontWeight: 'bold' },
  rangeTextActive: { color: 'white' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  webSummaryGrid: { flexWrap: 'nowrap', width: 780 },
  summaryCard: { flex: 1, minWidth: 180, backgroundColor: 'white', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { color: '#555', fontSize: 13 },
  summaryValue: { color: '#0077CC', fontSize: 26, fontWeight: 'bold', marginTop: 7 },
  panel: { backgroundColor: 'white', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 18 },
  webHighlightPanel: { marginTop: -8, overflow: 'hidden', boxShadow: '0 12px 24px rgba(0, 0, 0, 0.28)' } as any,
  panelTitle: { color: '#1a202c', fontSize: 18, fontWeight: 'bold', marginBottom: 18 },
  chart: { height: 210, flexDirection: 'row', alignItems: 'stretch', gap: 12, position: 'relative' },
  webChart: { height: 170, overflow: 'hidden' },
  chartBaseline: { position: 'absolute', left: 0, right: 0, bottom: 30, height: 1, backgroundColor: '#cbd5e0' },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 42 },
  barTrack: { height: 160, width: '72%', justifyContent: 'flex-end', backgroundColor: '#f2f8ff', borderRadius: 8, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: '#00A8A8', borderRadius: 8 },
  barLabel: { fontSize: 10, color: '#666', marginTop: 8, width: 72, textAlign: 'center' },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  webCountryRow: { minWidth: 760, width: 760 },
  countryName: { width: 130, color: '#334155', fontSize: 14 },
  countryTrack: { flex: 1, height: 10, borderRadius: 8, backgroundColor: '#e7f2f8', overflow: 'hidden' },
  countryBar: { height: '100%', borderRadius: 8, backgroundColor: '#0077CC' },
  countryCount: { width: 24, textAlign: 'right', color: '#0077CC', fontWeight: 'bold' },
  emptyText: { color: '#777', textAlign: 'center', paddingVertical: 20 },
  highlightViewport: { width: '100%' },
  webHighlightViewport: { height: 148, overflow: 'hidden' },
  highlightRow: { flexDirection: 'row', gap: 14 },
  webHighlightRow: { width: 860, flexWrap: 'nowrap' },
  webHighlightCardFirst: { zIndex: 3, transform: [{ translateX: 18 }, { translateY: 4 }] },
  webHighlightCardOverlap: { marginLeft: -76, zIndex: 2, transform: [{ translateY: 22 }] },
  webHighlightCardLast: { marginLeft: -76, zIndex: 1, transform: [{ translateY: 40 }] },
  highlightCard: { flex: 1, minWidth: 220, minHeight: 132, borderRadius: 16, backgroundColor: '#f2f8ff', padding: 16, borderWidth: 1, borderColor: '#c9e4f4', boxShadow: '0 10px 20px rgba(0, 119, 204, 0.22)' } as any,
  highlightKicker: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.7 },
  highlightValue: { color: '#0077CC', fontSize: 25, fontWeight: 'bold', marginTop: 12 },
  highlightText: { color: '#445', fontSize: 14, marginTop: 7 },
});
