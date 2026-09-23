import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { Dive } from '../types';
import { diveDate, filterDives, formatDiveTime, StatsRange, summarizeDives } from '../utils/diveStats';

export default function DiveStatsScreen() {
  const [dives, setDives] = useState<Dive[]>([]);
  const [range, setRange] = useState<StatsRange>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    let active = true;
    const controller = new AbortController();
    setNow(new Date());
    setLoading(true);
    setError(false);
    API.get<Dive[]>('/dives/my', { signal: controller.signal })
      .then(response => {
        if (!Array.isArray(response.data)) throw new Error('Unexpected statistics response');
        if (active) setDives(response.data);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]));

  const visibleDives = useMemo(() => filterDives(dives, range, now), [dives, range, now]);
  const { averageDepth, totalMinutes, countries, recent, maxDuration, deepestDive, longestDive } =
    useMemo(() => summarizeDives(visibleDives), [visibleDives]);
  const period = range === 'all' ? 'All time' : range === 'year' ? String(now.getFullYear() - 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (loading) return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color="#0077CC" accessibilityLabel="Loading statistics" />
      <Text style={styles.loadingText}>Loading statistics…</Text>
    </View>
  );

  if (error) return (
    <View style={styles.loading}>
      <Text accessibilityRole="alert" style={styles.emptyText}>Could not load your statistics. Please try again.</Text>
      <TouchableOpacity accessibilityRole="button" style={[styles.rangeButton, styles.rangeButtonActive]} onPress={() => setAttempt(value => value + 1)}>
        <Text style={styles.rangeTextActive}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>Dive statistics</Text>
          <Text style={styles.subtitle}>A summary of your logbook</Text>
        </View>
        <Text style={styles.periodText} accessibilityLiveRegion="polite">{period}</Text>
      </View>

      <View style={styles.rangeRow}>
        {([['all', 'All time'], ['year', 'Last year'], ['month', 'Last month']] as [StatsRange, string][]).map(([value, label]) => (
          <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: range === value }}
            accessibilityHint={value === 'all' ? 'Show all logged dives' : 'Show dives from the previous calendar ' + value}
            style={[styles.rangeButton, range === value && styles.rangeButtonActive]} onPress={() => { setNow(new Date()); setRange(value); }}>
            <Text style={[styles.rangeText, range === value && styles.rangeTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Dives</Text><Text style={styles.summaryValue}>{visibleDives.length}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Average depth</Text><Text style={styles.summaryValue}>{averageDepth} m</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Time underwater</Text><Text style={styles.summaryValue}>{formatDiveTime(totalMinutes)}</Text></View>
      </View>

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>Dive duration</Text>
        {recent.length ? <>
          <Text style={styles.chartDescription}>Latest {recent.length} {recent.length === 1 ? 'dive' : 'dives'} in this period · oldest to newest · minutes</Text>
          <View style={styles.chart}>
            {recent.map(dive => {
              const date = diveDate(dive.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <View key={dive.id} style={styles.barColumn} accessible accessibilityLabel={date + ', ' + dive.location + ', ' + dive.duration + ' minutes'}>
                  <Text style={styles.barValue}>{dive.duration} min</Text>
                  <View style={styles.barTrack} accessible={false}>
                    <View style={[styles.bar, { height: `${(dive.duration / maxDuration) * 100}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{date}</Text>
                </View>
              );
            })}
          </View>
        </> : <Text style={styles.emptyText}>No dives in this period.</Text>}
      </View>

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>Highlights</Text>
        <View style={styles.highlightRow}>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightKicker}>DEEPEST DIVE</Text>
            <Text style={styles.highlightValue}>{deepestDive ? deepestDive.maxDepth + ' m' : '—'}</Text>
            <Text style={styles.highlightText}>{deepestDive?.location || 'No dives in this period'}</Text>
          </View>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightKicker}>LONGEST DIVE</Text>
            <Text style={styles.highlightValue}>{longestDive ? longestDive.duration + ' min' : '—'}</Text>
            <Text style={styles.highlightText}>{longestDive?.location || 'No dives in this period'}</Text>
          </View>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightKicker}>TOP COUNTRY</Text>
            <Text style={styles.highlightValue}>{countries.length ? countries[0][1] + (countries[0][1] === 1 ? ' dive' : ' dives') : '—'}</Text>
            <Text style={styles.highlightText}>{countries[0]?.[0] || 'No country in this period'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>Countries visited</Text>
        {countries.length ? countries.map(([country, count]) => (
          <View key={country} style={styles.countryRow} accessible accessibilityLabel={country + ': ' + count + (count === 1 ? ' dive' : ' dives')}>
            <View style={styles.countryHeading}>
              <Text style={styles.countryName}>{country}</Text>
              <Text style={styles.countryCount}>{count}</Text>
            </View>
            <View style={styles.countryTrack} accessible={false}><View style={[styles.countryBar, { width: `${(count / countries[0][1]) * 100}%` }]} /></View>
          </View>
        )) : <Text style={styles.emptyText}>No countries to display.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  loading: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f9fc' },
  loadingText: { color: '#555', marginTop: 12 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  headingCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0077CC' },
  subtitle: { fontSize: 15, color: '#555', marginTop: 4 },
  periodText: { color: '#0077CC', fontWeight: 'bold', marginBottom: 4, flexShrink: 1 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  rangeButton: { minHeight: 44, justifyContent: 'center', backgroundColor: 'white', borderColor: '#b8d8ee', borderWidth: 1, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10 },
  rangeButtonActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  rangeText: { color: '#0077CC', fontWeight: 'bold' },
  rangeTextActive: { color: 'white', fontWeight: 'bold' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  summaryCard: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, backgroundColor: 'white', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { color: '#555', fontSize: 13 },
  summaryValue: { color: '#0077CC', fontSize: 26, fontWeight: 'bold', marginTop: 7 },
  panel: { backgroundColor: 'white', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 18 },
  panelTitle: { color: '#1a202c', fontSize: 18, fontWeight: 'bold', marginBottom: 18 },
  chartDescription: { color: '#555', fontSize: 13, marginBottom: 16 },
  chart: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  barColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 90, minWidth: 0, alignItems: 'center' },
  barValue: { color: '#334155', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  barTrack: { height: 160, width: '72%', maxWidth: 100, justifyContent: 'flex-end', backgroundColor: '#f2f8ff', borderRadius: 8, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: '#00A8A8', borderRadius: 8 },
  barLabel: { fontSize: 12, color: '#555', marginTop: 8, textAlign: 'center', width: '100%' },
  countryRow: { marginBottom: 16 },
  countryHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  countryName: { flex: 1, minWidth: 0, color: '#334155', fontSize: 14 },
  countryTrack: { width: '100%', height: 10, borderRadius: 8, backgroundColor: '#e7f2f8', overflow: 'hidden' },
  countryBar: { height: '100%', borderRadius: 8, backgroundColor: '#0077CC' },
  countryCount: { color: '#0077CC', fontWeight: 'bold' },
  emptyText: { color: '#555', textAlign: 'center', paddingVertical: 20 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  highlightCard: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, borderRadius: 16, backgroundColor: '#f2f8ff', padding: 16, borderWidth: 1, borderColor: '#c9e4f4' },
  highlightKicker: { color: '#0077CC', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.7 },
  highlightValue: { color: '#0077CC', fontSize: 25, fontWeight: 'bold', marginTop: 12 },
  highlightText: { color: '#445', fontSize: 14, marginTop: 7 },
});
