import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { PokedexSpecies } from '../types';

type GeoGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
type GeoFeature = { properties?: { name?: string }; geometry: GeoGeometry };
type PeriodKey = 'week' | 'month' | 'sixMonths' | 'year' | 'all';
type MapSpecies = PokedexSpecies & { count: number };
type MarinePoint = {
  latitude: number;
  longitude: number;
  precision: 'location' | 'country';
  country: string;
  location: string;
  sightings: number;
  dives: number;
  lastSeen: string;
  species: MapSpecies[];
};
type MarineMapResponse = { period: PeriodKey; speciesKey: string | null; points: MarinePoint[]; totalSightings: number; totalLocations: number; generatedAt: string };

const MAP_WIDTH = 940;
const MAP_HEIGHT = 477;
const WORLD_GEOJSON = require('../assets/world.json') as { features: GeoFeature[] };
const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'week', label: 'Last week' },
  { key: 'month', label: 'Last month' },
  { key: 'sixMonths', label: 'Last 6 months' },
  { key: 'year', label: 'Last year' },
  { key: 'all', label: 'All time' },
];

const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const project = (longitude: number, latitude: number) => ({
  x: ((longitude + 180) / 360) * MAP_WIDTH,
  y: ((90 - latitude) / 180) * MAP_HEIGHT,
});
const ringToPath = (ring: number[][]) => ring.map(([longitude, latitude], index) => {
  const point = project(longitude, latitude);
  return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}).join(' ') + ' Z';
const geometryToPath = (geometry: GeoGeometry) => geometry.type === 'Polygon'
  ? geometry.coordinates.map(ringToPath).join(' ')
  : geometry.coordinates.flatMap((polygon: number[][][]) => polygon.map(ringToPath)).join(' ');
const WORLD_FEATURES = WORLD_GEOJSON.features.map((feature, index) => ({
  ...feature,
  key: feature.properties?.name || `country-${index}`,
  path: geometryToPath(feature.geometry),
}));

export default function MarineLifeMapScreen() {
  const compact = useWindowDimensions().width < 600;
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [speciesKey, setSpeciesKey] = useState<string>('');
  const [species, setSpecies] = useState<PokedexSpecies[]>([]);
  const [data, setData] = useState<MarineMapResponse | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MarinePoint | null>(null);
  const [speciesModal, setSpeciesModal] = useState(false);
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [mapZoom, setMapZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [catalogResponse, mapResponse] = await Promise.all([
        API.get<PokedexSpecies[]>('/pokedex/species', { signal }),
        API.get<MarineMapResponse>('/pokedex/marine-map', {
          signal,
          params: {
            period,
            ...(speciesKey ? { speciesKey } : {}),
          },
        }),
      ]);
      if (!signal?.aborted) {
        setSpecies(Array.isArray(catalogResponse.data) ? catalogResponse.data : []);
        setData(mapResponse.data);
      }
    } catch (err: any) {
      if (!signal?.aborted) setError(err?.response?.data?.message || 'Could not load the community marine-life map.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [period, speciesKey]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]));

  useEffect(() => {
    if (selectedPoint && !data?.points.some((point) => point.location === selectedPoint.location && point.country === selectedPoint.country)) setSelectedPoint(null);
  }, [data, selectedPoint]);

  const selectedSpecies = species.find((item) => item.key === speciesKey);
  const filteredSpecies = useMemo(() => {
    const query = normalize(speciesQuery.trim());
    return species.filter((item) => !query || normalize(`${item.name} ${item.category}`).includes(query));
  }, [species, speciesQuery]);
  const maxSightings = Math.max(...(data?.points || []).map((point) => point.sightings), 1);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.heroCopy}>
        <Text accessibilityRole="header" style={styles.eyebrow}>COMMUNITY MARINE LIFE</Text>
        <Text style={styles.title}>Marine life map</Text>
        <Text style={styles.subtitle}>A shared heatmap built from sightings logged by buddies and dive centers.</Text>
      </View>
      <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>Live community data</Text></View>
    </View>

    <View style={[styles.filterPanel, compact && styles.filterPanelNarrow]}>
      <Text style={styles.filterLabel}>Species</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose species filter" accessibilityState={{ expanded: speciesModal }} onPress={() => setSpeciesModal(true)} style={[styles.speciesSelect, compact && styles.speciesSelectNarrow]}>
        <Text style={selectedSpecies ? styles.speciesSelectText : styles.speciesPlaceholder}>{selectedSpecies?.name || 'All marine life'}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>
      <Text style={styles.filterLabel}>Time range</Text>
      <View style={[styles.periodClip, compact && styles.periodClipNarrow]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.periodRow, compact && styles.periodRowNarrow]}>
          {PERIODS.map((item) => (
            <TouchableOpacity key={item.key} accessibilityRole="button" accessibilityState={{ selected: period === item.key }} aria-pressed={period === item.key} onPress={() => setPeriod(item.key)} style={[styles.periodButton, period === item.key && styles.periodButtonActive]}>
              <Text style={period === item.key ? styles.periodTextActive : styles.periodText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>

    <View style={styles.statsRow}>
      <View style={styles.stat}><Text style={styles.statValue}>{data?.totalSightings || 0}</Text><Text style={styles.statLabel}>Sightings</Text></View>
      <View style={styles.stat}><Text style={styles.statValue}>{data?.totalLocations || 0}</Text><Text style={styles.statLabel}>Dive zones</Text></View>
      <View style={styles.stat}><Text style={[styles.statValue, selectedSpecies && styles.statValueSelected]}>{selectedSpecies?.name || 'All'}</Text><Text style={styles.statLabel}>Selected species</Text></View>
    </View>

    {loading ? <View style={styles.loading}><ActivityIndicator color="#007c7e" /><Text style={styles.muted}>Updating community sightings…</Text></View> : error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View> : <>
      <View style={[styles.mapCard, compact && styles.mapCardNarrow]}>
        <View style={styles.mapHeader}><View><Text style={styles.sectionTitle}>Sightings heatmap</Text><Text style={styles.mapHint}>Larger, warmer circles mean more logged sightings.</Text></View><Text style={styles.updated}>{data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</Text></View>
        <View style={[styles.mapViewport, compact && styles.mapViewportNarrow]} accessibilityLabel="Community marine life sightings map">
          <View style={styles.mapZoomControls}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom in marine life map" onPress={() => setMapZoom((value) => Math.min(6, value + 1))} style={styles.mapZoomButton}><Text style={styles.mapZoomText}>+</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom out marine life map" onPress={() => setMapZoom((value) => Math.max(1, value - 1))} style={styles.mapZoomButton}><Text style={styles.mapZoomText}>−</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset marine life map zoom" onPress={() => setMapZoom(1)} style={styles.mapResetButton}><Text style={styles.mapResetText}>{Math.round(mapZoom * 100)}%</Text></TouchableOpacity>
          </View>
          {(() => {
            const vbWidth = MAP_WIDTH / mapZoom;
            const vbHeight = MAP_HEIGHT / mapZoom;
            let vbX = (MAP_WIDTH - vbWidth) / 2;
            let vbY = (MAP_HEIGHT - vbHeight) / 2;
            if (selectedPoint && mapZoom > 1) {
              const pos = project(selectedPoint.longitude, selectedPoint.latitude);
              vbX = Math.max(0, Math.min(MAP_WIDTH - vbWidth, pos.x - vbWidth / 2));
              vbY = Math.max(0, Math.min(MAP_HEIGHT - vbHeight, pos.y - vbHeight / 2));
            }
            return (
              <Svg style={styles.map} viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`} preserveAspectRatio="xMidYMid meet">
                <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#d7f1f3" />
                {WORLD_FEATURES.map((feature) => <Path key={feature.key} d={feature.path} fill="#eff8f8" stroke="#a5c9ce" strokeWidth={0.65} />)}
                {data?.points.map((point, index) => {
                  const position = project(point.longitude, point.latitude);
                  const intensity = point.sightings / maxSightings;
                  const radius = 8 + Math.sqrt(intensity) * 21;
                  const isSelected = selectedPoint?.location === point.location && selectedPoint?.country === point.country;
                  return <G key={`${point.country}-${point.location}-${index}`} onPress={() => setSelectedPoint(point)} accessibilityLabel={`${point.location}, ${point.sightings} sightings`}>
                    <Circle cx={position.x} cy={position.y} r={radius * 1.8} fill="#f97316" opacity={0.13 + intensity * 0.12} />
                    <Circle cx={position.x} cy={position.y} r={radius} fill={intensity > 0.65 ? '#ef4444' : intensity > 0.3 ? '#f97316' : '#f4b942'} opacity={isSelected ? 0.95 : 0.68} stroke={isSelected ? '#0c5264' : '#fff'} strokeWidth={isSelected ? 2.5 : 1.5} />
                    <SvgText x={position.x} y={position.y + 4} fill="#fff" fontSize={11} fontWeight="bold" textAnchor="middle">{point.sightings}</SvgText>
                  </G>;
                })}
              </Svg>
            );
          })()}
        </View>
        <View style={styles.legend}><View style={styles.legendScale}><View style={[styles.legendDot, { backgroundColor: '#f4b942' }]} /><Text style={styles.legendText}>Few</Text><View style={[styles.legendDot, { backgroundColor: '#f97316' }]} /><Text style={styles.legendText}>Some</Text><View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>Many</Text></View><Text style={styles.precisionHint}>Country-level fallback is marked in each detail card.</Text></View>
      </View>

      {selectedPoint ? <View style={[styles.detailCard, compact && styles.detailCardNarrow]}><View style={styles.detailHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.detailEyebrow}>SELECTED ZONE</Text><Text style={styles.detailTitle}>{selectedPoint.location}</Text><Text style={styles.detailCountry}>{selectedPoint.country} · {selectedPoint.sightings} sightings across {selectedPoint.dives} dive{selectedPoint.dives === 1 ? '' : 's'}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close selected map zone" onPress={() => setSelectedPoint(null)} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity></View><View style={styles.speciesList}>{selectedPoint.species.map((item) => <View key={item.key} style={styles.speciesChip}><Text style={styles.speciesChipName}>{item.name}</Text><Text style={styles.speciesChipCount}>{item.count}</Text></View>)}</View><Text style={styles.lastSeen}>Last logged {new Date(selectedPoint.lastSeen).toLocaleDateString()} · {selectedPoint.precision === 'location' ? 'site coordinates' : 'country centroid'}</Text></View> : null}

      <View style={styles.listHeader}><Text style={styles.sectionTitle}>Active dive zones</Text><Text style={styles.count}>{data?.points.length || 0} shown</Text></View>
      {data?.points.length ? <View style={[styles.zoneList, compact && styles.zoneListNarrow]}>{data.points.map((point) => <TouchableOpacity key={`${point.country}-${point.location}`} accessibilityRole="button" onPress={() => setSelectedPoint(point)} style={[styles.zoneCard, compact && styles.zoneCardNarrow]}><View style={styles.zoneCopy}><Text style={styles.zoneTitle}>{point.location}</Text><Text style={styles.zoneMeta}>{point.country} · {point.precision === 'location' ? 'Site location' : 'Country-level estimate'}</Text></View><View style={styles.zoneCount}><Text style={styles.zoneNumber}>{point.sightings}</Text><Text style={styles.zoneLabel}>sightings</Text></View></TouchableOpacity>)}</View> : <View style={styles.empty}><Text style={styles.emptyTitle}>No sightings match these filters</Text><Text style={styles.muted}>Try a wider time range or choose All marine life.</Text></View>}
    </>}

    <Modal visible={speciesModal} transparent animationType="fade" onRequestClose={() => setSpeciesModal(false)}>
      <View style={styles.backdrop}><View style={[styles.speciesModal, compact && styles.speciesModalCompact]}><View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Filter by species</Text><Text style={styles.muted}>Choose from the Pokedex catalog.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close species filter" onPress={() => setSpeciesModal(false)} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity></View><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Search species" placeholder="Search species" value={speciesQuery} onChangeText={setSpeciesQuery} style={styles.searchInput} /></View><ScrollView scrollEnabled={true} style={styles.speciesOptions}><TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: !speciesKey }} onPress={() => { setSpeciesKey(''); setSpeciesQuery(''); setSpeciesModal(false); }} style={[styles.speciesOption, !speciesKey && styles.speciesOptionActive]}><Text style={styles.speciesOptionName}>All marine life</Text><Text style={styles.speciesOptionCategory}>Every species in the shared catalog</Text></TouchableOpacity>{filteredSpecies.map((item) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: speciesKey === item.key }} key={item.key} onPress={() => { setSpeciesKey(item.key); setSpeciesQuery(''); setSpeciesModal(false); }} style={[styles.speciesOption, speciesKey === item.key && styles.speciesOptionActive]}><Text style={styles.speciesOptionName}>{item.name}</Text><Text style={styles.speciesOptionCategory}>{item.category}</Text></TouchableOpacity>)}</ScrollView></View></View>
    </Modal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4fafb' }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 54 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#0c5264', borderRadius: 22, padding: 24 }, heroCopy: { flex: 1, minWidth: 240 }, eyebrow: { color: '#8ee7dc', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 }, title: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: 6 }, subtitle: { color: '#d1edf0', lineHeight: 20, marginTop: 7, maxWidth: 620 }, liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#174f5b', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#62e6b8', marginRight: 7 }, liveText: { color: '#c9f9e9', fontSize: 12, fontWeight: 'bold' },
  filterPanel: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#d6e8eb', padding: 16, marginTop: 16 }, filterPanelNarrow: { paddingHorizontal: 14 }, filterLabel: { color: '#406875', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 7 }, speciesSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#9bc9d0', borderRadius: 11, minHeight: 46, paddingHorizontal: 13, marginBottom: 14 }, speciesSelectNarrow: { width: '100%', borderRadius: 11 }, speciesSelectText: { color: '#124d5d', fontWeight: 'bold' }, speciesPlaceholder: { color: '#6c8790' }, chevron: { color: '#007c7e', fontSize: 20 }, periodClip: { overflow: 'visible' }, periodClipNarrow: { width: '100%' }, periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, periodRowNarrow: { flexWrap: 'nowrap', gap: 8 }, periodButton: { borderWidth: 1, borderColor: '#b7d7dc', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, justifyContent: 'center' }, periodButtonActive: { backgroundColor: '#087f80', borderColor: '#087f80' }, periodText: { color: '#316575', fontSize: 12, fontWeight: '600' }, periodTextActive: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }, stat: { flex: 1, minWidth: 145, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#d6e8eb', padding: 14 }, statValue: { color: '#0c6672', fontSize: 21, fontWeight: 'bold' }, statValueSelected: { fontSize: 18 }, statLabel: { color: '#6c8790', fontSize: 11, marginTop: 4 }, loading: { alignItems: 'center', padding: 48 }, muted: { color: '#6c8790', fontSize: 12, marginTop: 5 }, errorCard: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 16, marginTop: 16 }, error: { color: '#b42318', textAlign: 'center' }, retry: { marginTop: 14, backgroundColor: '#087f80', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }, retryText: { color: '#fff', fontWeight: 'bold' },
  mapCard: { backgroundColor: '#fff', borderRadius: 19, borderWidth: 1, borderColor: '#d6e8eb', padding: 16, marginTop: 16, shadowColor: '#164c67', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, mapCardNarrow: { borderRadius: 16, paddingHorizontal: 12 }, mapHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }, sectionTitle: { color: '#124d5d', fontSize: 19, fontWeight: 'bold' }, mapHint: { color: '#6c8790', fontSize: 12, marginTop: 4 }, updated: { color: '#6c8790', fontSize: 11 }, mapViewport: { width: '100%', aspectRatio: MAP_WIDTH / MAP_HEIGHT, minHeight: 280, overflow: 'hidden', borderRadius: 14, backgroundColor: '#d7f1f3', position: 'relative' }, mapViewportNarrow: { minHeight: 240, borderRadius: 12 }, map: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', zIndex: 1 }, mapZoomControls: { position: 'absolute', zIndex: 10, right: 12, top: 12, gap: 6 }, mapZoomButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#8bbec5', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 }, mapZoomText: { color: '#087f80', fontSize: 22, fontWeight: 'bold', lineHeight: 24 }, mapResetButton: { minWidth: 40, height: 28, borderRadius: 8, backgroundColor: '#087f80', alignItems: 'center', justifyContent: 'center' }, mapResetText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }, legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 10 }, legendScale: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendDot: { width: 12, height: 12, borderRadius: 6 }, legendText: { color: '#58747d', fontSize: 11 }, precisionHint: { color: '#78909a', fontSize: 10 },
  detailCard: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#8cc9cb', borderLeftWidth: 5, borderLeftColor: '#087f80', padding: 16, marginTop: 14, shadowColor: '#164c67', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, detailCardNarrow: { width: '100%', marginLeft: 0, marginRight: 0, borderLeftWidth: 5, borderLeftColor: '#087f80' }, detailHeader: { flexDirection: 'row', alignItems: 'flex-start' }, detailEyebrow: { color: '#087f80', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 }, detailTitle: { color: '#124d5d', fontSize: 20, fontWeight: 'bold', marginTop: 3 }, detailCountry: { color: '#58747d', marginTop: 5, fontSize: 12 }, close: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' }, closeText: { color: '#5b7881', fontSize: 26 }, speciesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }, speciesChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eaf7f6', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, speciesChipName: { color: '#17646c', fontSize: 11 }, speciesChipCount: { color: '#087f80', fontWeight: 'bold', fontSize: 11, marginLeft: 7 }, lastSeen: { color: '#78909a', fontSize: 11, marginTop: 12 }, listHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }, count: { color: '#087f80', fontSize: 12, fontWeight: 'bold' }, zoneList: { gap: 9 }, zoneListNarrow: { width: '100%', gap: 9 }, zoneCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#d6e8eb', padding: 14, minHeight: 65, shadowColor: '#164c67', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }, zoneCardNarrow: { width: '100%', marginBottom: 0, borderRadius: 14, shadowColor: '#164c67', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }, zoneCopy: { flex: 1, minWidth: 0 }, zoneTitle: { color: '#124d5d', fontSize: 15, fontWeight: 'bold' }, zoneMeta: { color: '#6c8790', fontSize: 11, marginTop: 4 }, zoneCount: { alignItems: 'flex-end', marginLeft: 10 }, zoneNumber: { color: '#087f80', fontSize: 20, fontWeight: 'bold' }, zoneLabel: { color: '#6c8790', fontSize: 10 }, empty: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, padding: 30, borderWidth: 1, borderColor: '#d6e8eb' }, emptyTitle: { color: '#124d5d', fontWeight: 'bold' },
  backdrop: { flex: 1, backgroundColor: 'rgba(4, 34, 43, .52)', justifyContent: 'center', alignItems: 'center', padding: 16 }, speciesModal: { width: '100%', maxWidth: 520, maxHeight: '82%', backgroundColor: '#fff', borderRadius: 18, padding: 17, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 8 }, speciesModalCompact: { width: '100%', maxWidth: '100%', maxHeight: '85%', borderRadius: 16 }, modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }, modalTitle: { color: '#124d5d', fontSize: 18, fontWeight: 'bold' }, searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#b7d7dc', borderRadius: 10, paddingLeft: 10, marginBottom: 8 }, searchIcon: { color: '#087f80', fontSize: 18 }, searchInput: { flex: 1, minHeight: 43, paddingHorizontal: 8, color: '#124d5d' }, speciesOptions: { maxHeight: 340 }, speciesOption: { borderBottomWidth: 1, borderBottomColor: '#edf3f4', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 }, speciesOptionActive: { backgroundColor: '#eaf7f6' }, speciesOptionName: { color: '#124d5d', fontWeight: 'bold' }, speciesOptionCategory: { color: '#6c8790', fontSize: 11, marginTop: 3 },
});
