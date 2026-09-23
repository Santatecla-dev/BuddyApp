import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import API from '../api/api';
import { Dive } from '../types';
import { diveDate } from '../utils/diveStats';
import { canonicalCountryKey } from '../utils/countries';

type Marker = { country: string; dives: Dive[] };
type GeoGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
type GeoFeature = { properties?: { name?: string }; geometry: GeoGeometry };
type ViewMode = 'map' | 'list';
type SortKey = 'recent' | 'depth' | 'duration';

const MAP_WIDTH = 940;
const MAP_HEIGHT = 477;
const WORLD_GEOJSON = require('../assets/world.json') as { features: GeoFeature[] };

const siteKey = (dive: Dive) => JSON.stringify([canonicalCountryKey(dive.country), dive.location.trim().toLocaleLowerCase()]);
const searchText = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const project = (longitude: number, latitude: number) => ({
  x: ((longitude + 180) / 360) * MAP_WIDTH,
  y: ((90 - latitude) / 180) * MAP_HEIGHT,
});

const ringToPath = (ring: number[][]) => ring.map(([longitude, latitude], index) => {
  const point = project(longitude, latitude);
  return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}).join(' ') + ' Z';

const geometryToPath = (geometry: GeoGeometry) => {
  if (geometry.type === 'Polygon') return geometry.coordinates.map(ringToPath).join(' ');
  return geometry.coordinates.flatMap((polygon: number[][][]) => polygon.map(ringToPath)).join(' ');
};

const geometryCenter = (geometry: GeoGeometry) => {
  const points: number[][] = geometry.type === 'Polygon'
    ? geometry.coordinates[0]
    : geometry.coordinates[0]?.[0] || [];
  if (!points.length) return project(0, 0);
  const totals = points.reduce((sum, point) => ({ longitude: sum.longitude + point[0], latitude: sum.latitude + point[1] }), { longitude: 0, latitude: 0 });
  return project(totals.longitude / points.length, totals.latitude / points.length);
};

const WORLD_FEATURES = WORLD_GEOJSON.features.map((feature, index) => ({
  ...feature,
  name: feature.properties?.name || `country-${index}`,
  key: canonicalCountryKey(feature.properties?.name || `country-${index}`),
  path: geometryToPath(feature.geometry),
  center: geometryCenter(feature.geometry),
}));

export default function DiveMapScreen({ navigation }: any) {
  const compact = useWindowDimensions().width < 600;
  const [dives, setDives] = useState<Dive[]>([]);
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [selectedDive, setSelectedDive] = useState<Dive | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [savedSites, setSavedSites] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    API.get<Dive[]>('/dives/my', { signal: controller.signal })
      .then((response) => {
        if (!Array.isArray(response.data)) throw new Error('Invalid dives response');
        if (active) setDives(response.data);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]));

  const filteredDives = useMemo(() => {
    const value = searchText(query.trim());
    const countryQuery = canonicalCountryKey(query);
    return dives.filter((dive) =>
      (!countryFilter || canonicalCountryKey(dive.country) === canonicalCountryKey(countryFilter)) &&
      (!showSavedOnly || savedSites.includes(siteKey(dive))) &&
      (!value || searchText(`${dive.location} ${dive.country}`).includes(value) ||
        (countryQuery.length > 0 && canonicalCountryKey(dive.country).includes(countryQuery)))
    );
  }, [dives, query, countryFilter, showSavedOnly, savedSites]);

  const groupedDives = useMemo(() => filteredDives.reduce<Record<string, Dive[]>>((groups, dive) => {
    const key = canonicalCountryKey(dive.country);
    (groups[key] ||= []).push(dive);
    return groups;
  }, {}), [filteredDives]);

  const countryGroups = useMemo(() => Object.entries(groupedDives).reduce<Record<string, Marker>>((groups, [country, countryDives]) => {
    groups[country] = { country: countryDives[0].country, dives: [...countryDives].sort((a, b) => diveDate(b.date).getTime() - diveDate(a.date).getTime()) };
    return groups;
  }, {}), [groupedDives]);

  const sortedDives = useMemo(() => {
    const result = [...filteredDives].sort((a, b) => {
      if (sortKey === 'depth') return Number(b.maxDepth || 0) - Number(a.maxDepth || 0);
      if (sortKey === 'duration') return Number(b.duration || 0) - Number(a.duration || 0);
      return diveDate(b.date).getTime() - diveDate(a.date).getTime();
    });
    return result;
  }, [filteredDives, sortKey]);

  const activeMarker = selectedMarker ? countryGroups[canonicalCountryKey(selectedMarker.country)] : null;
  useEffect(() => {
    if (selectedDive && !filteredDives.some(dive => dive.id === selectedDive.id)) setSelectedDive(null);
    if (selectedMarker && !countryGroups[canonicalCountryKey(selectedMarker.country)]) setSelectedMarker(null);
  }, [filteredDives, countryGroups, selectedDive, selectedMarker]);

  const averageDepth = filteredDives.length
    ? Math.round(filteredDives.reduce((total, dive) => total + Number(dive.maxDepth || 0), 0) / filteredDives.length)
    : 0;
  const savedCount = new Set(dives.filter((dive) => savedSites.includes(siteKey(dive))).map(siteKey)).size;
  const sortLabels: Record<SortKey, string> = { recent: 'Most recent', depth: 'Deepest first', duration: 'Longest first' };

  const toggleSaved = (dive: Dive) => {
    const key = siteKey(dive);
    setSavedSites((current) => current.includes(key)
      ? current.filter((location) => location !== key)
      : [...current, key]);
  };

  const openDive = (dive: Dive) => {
    setSelectedDive(dive);
    const group = countryGroups[canonicalCountryKey(dive.country)];
    if (group) setSelectedMarker(group);
  };

  const unplacedCountries = Object.values(countryGroups)
    .filter((group) => !WORLD_FEATURES.some((feature) => feature.key === canonicalCountryKey(group.country)))
    .map((group) => group.country);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>Dive sites</Text>
          <Text style={styles.subtitle}>Explore, compare and revisit the places in your logbook</Text>
        </View>
        <View style={styles.headingActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show saved sites" aria-pressed={showSavedOnly} accessibilityState={{ selected: showSavedOnly }} style={[styles.savedPill, showSavedOnly && styles.filterButtonSelected]} onPress={() => setShowSavedOnly((value) => !value)}>
            <Text style={styles.savedPillText}>☆ {savedCount} saved</Text>
          </TouchableOpacity>
          <Text style={styles.resultCount}>{filteredDives.length} dives</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search by site or country" accessibilityLabel="Search dive sites" style={styles.searchInput} />
        {query.length > 0 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearSearch} onPress={() => setQuery('')}><Text style={styles.clearSearchText}>×</Text></TouchableOpacity>}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity accessibilityRole="button" aria-pressed={!countryFilter && !query && !showSavedOnly} accessibilityState={{ selected: !countryFilter && !query && !showSavedOnly }} style={[styles.filterButton, !countryFilter && !query && !showSavedOnly && styles.filterActive]} onPress={() => { setQuery(''); setCountryFilter(''); setShowSavedOnly(false); }}><Text style={!countryFilter && !query && !showSavedOnly ? styles.filterActiveText : styles.filterText}>All sites</Text></TouchableOpacity>
        {['Spain', 'Portugal', 'Mexico'].map(country => <TouchableOpacity key={country} accessibilityRole="button" aria-pressed={countryFilter === country} accessibilityState={{ selected: countryFilter === country }} style={[styles.filterButton, countryFilter === country && styles.filterActive]} onPress={() => setCountryFilter(current => current === country ? '' : country)}><Text style={countryFilter === country ? styles.filterActiveText : styles.filterText}>{country}</Text></TouchableOpacity>)}
        <TouchableOpacity accessibilityRole="button" aria-pressed={showSavedOnly} accessibilityState={{ selected: showSavedOnly }} style={[styles.filterButton, showSavedOnly && styles.filterActive]} onPress={() => setShowSavedOnly((value) => !value)}><Text style={showSavedOnly ? styles.filterActiveText : styles.filterText}>Saved</Text></TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, compact && styles.statCardCompact]}><Text style={styles.statValue}>{filteredDives.length}</Text><Text style={styles.statLabel}>Logged dives</Text></View>
        <View style={[styles.statCard, compact && styles.statCardCompact]}><Text style={styles.statValue}>{Object.keys(countryGroups).length}</Text><Text style={styles.statLabel}>Countries</Text></View>
        <View style={[styles.statCard, compact && styles.statCardCompact]}><Text style={styles.statValue}>{averageDepth}m</Text><Text style={styles.statLabel}>Average max depth</Text></View>
        <View style={[styles.statCard, compact && styles.statCardCompact]}><Text style={styles.statValue}>{savedCount}</Text><Text style={styles.statLabel}>Saved sites</Text></View>
      </View>

      <View style={styles.exploreToolbar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity accessibilityRole="button" aria-pressed={viewMode === 'map'} accessibilityState={{ selected: viewMode === 'map' }} style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleActive]} onPress={() => setViewMode('map')}><Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>Map</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" aria-pressed={viewMode === 'list'} accessibilityState={{ selected: viewMode === 'list' }} style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]} onPress={() => setViewMode('list')}><Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>List</Text></TouchableOpacity>
        </View>
        <View style={styles.sortWrap}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Sort dives: ${sortLabels[sortKey]}`} aria-expanded={sortMenuOpen} accessibilityState={{ expanded: sortMenuOpen }} style={styles.sortButton} onPress={() => setSortMenuOpen((value) => !value)}><Text style={styles.sortButtonText}>Sort: {sortLabels[sortKey]}</Text><Text style={styles.sortChevron}>⌄</Text></TouchableOpacity>
          {sortMenuOpen && <View style={styles.sortMenu}>
            {(Object.keys(sortLabels) as SortKey[]).map((key) => <TouchableOpacity accessibilityRole="button" aria-pressed={sortKey === key} accessibilityState={{ selected: sortKey === key }} key={key} style={styles.sortOption} onPress={() => { setSortKey(key); setSortMenuOpen(false); }}><Text style={styles.sortOptionText}>{sortLabels[key]}</Text></TouchableOpacity>)}
          </View>}
        </View>
      </View>

      {loading ? <ActivityIndicator accessibilityLabel="Loading dive sites" color="#0077CC" /> : error ? <View style={styles.emptyCard}>
        <Text accessibilityRole="alert" style={styles.emptyText}>Could not load your dive sites.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.filterButton} onPress={() => setAttempt(value => value + 1)}><Text style={styles.filterText}>Retry</Text></TouchableOpacity>
      </View> : viewMode === 'map' && <>
        <WorldMap groups={countryGroups} selected={activeMarker?.country} onSelect={setSelectedMarker} />
        {activeMarker && <View style={styles.popup}>
          <View style={styles.detailHeader}><Text style={[styles.popupTitle, styles.siteCardMain]}>{activeMarker.country}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close country details" style={styles.closeButton} onPress={() => setSelectedMarker(null)}><Text style={styles.detailClose}>×</Text></TouchableOpacity></View>
          <Text style={styles.popupText}>{activeMarker.dives.length} logged dive{activeMarker.dives.length === 1 ? '' : 's'}</Text>
          {activeMarker.dives.slice(0, 2).map(dive => <TouchableOpacity accessibilityRole="button" key={dive.id} style={styles.popupAction} onPress={() => openDive(dive)}><Text style={styles.popupDive}>{dive.location}</Text></TouchableOpacity>)}
          <TouchableOpacity accessibilityRole="button" style={styles.popupAction} onPress={() => navigation.navigate('DiveDetail', { diveId: activeMarker.dives[0].id })}><Text style={styles.popupLink}>View latest dive</Text></TouchableOpacity>
        </View>}
        <Text style={styles.mapCredit}>Country-level locations · Vector borders: GeoJSON world country boundaries</Text>
      </>}

      <View style={styles.listHeading}><Text style={styles.sectionTitle}>{viewMode === 'map' ? 'Recent dive sites' : 'All logged sites'}</Text><Text style={styles.sectionHint}>{sortedDives.length} shown</Text></View>
      {!loading && !error && (sortedDives.length > 0 ? <View style={styles.siteList}>
        {sortedDives.map((dive, index) => {
          const saved = savedSites.includes(siteKey(dive));
          return <View key={`${dive.id}-${index}`} style={[styles.siteCard, saved && styles.savedSiteCard, selectedDive?.id === dive.id && styles.selectedSiteCard]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Select dive at ${dive.location}, ${dive.country}`} aria-pressed={selectedDive?.id === dive.id} accessibilityState={{ selected: selectedDive?.id === dive.id }} style={styles.siteCardMain} onPress={() => openDive(dive)}><Text style={styles.siteName}>{dive.location}</Text><Text style={styles.siteCountry}>{dive.country}</Text><Text style={styles.siteMeta}>{diveDate(dive.date).toLocaleDateString()} · {dive.maxDepth || 0}m · {dive.duration || 0} min</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" aria-pressed={saved} accessibilityState={{ selected: saved }} style={styles.saveButton} onPress={() => toggleSaved(dive)} accessibilityLabel={saved ? `Remove ${dive.location} from saved sites` : `Save ${dive.location}`}><Text style={[styles.saveIcon, saved && styles.saveIconActive]}>{saved ? '★' : '☆'}</Text></TouchableOpacity>
          </View>;
        })}
      </View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No sites to show</Text><Text style={styles.emptyText}>Try a different search or clear your filters.</Text></View>)}

      {selectedDive && <View style={styles.detailCard}>
        <View style={styles.detailHeader}><View style={styles.siteCardMain}><Text style={styles.detailEyebrow}>Selected dive</Text><Text style={styles.detailTitle}>{selectedDive.location}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close selected dive" style={styles.closeButton} onPress={() => setSelectedDive(null)}><Text style={styles.detailClose}>×</Text></TouchableOpacity></View>
        <Text style={styles.detailCountry}>{selectedDive.country} · {diveDate(selectedDive.date).toLocaleDateString()}</Text>
        <View style={styles.detailStats}><Text style={styles.detailStat}>{selectedDive.maxDepth || 0}m max depth</Text><Text style={styles.detailStat}>{selectedDive.duration || 0} min underwater</Text></View>
        <TouchableOpacity accessibilityRole="button" style={styles.detailButton} onPress={() => navigation.navigate('DiveDetail', { diveId: selectedDive.id })}><Text style={styles.detailButtonText}>Open dive log</Text></TouchableOpacity>
      </View>}

      {unplacedCountries.length > 0 && <Text style={styles.unplacedText}>No map shape for: {unplacedCountries.join(', ')}</Text>}
    </ScrollView>
  );
}

// Camera changes only the SVG viewBox; controls and details never scale or clip.
const WorldMap = React.memo(function WorldMap({ groups, selected, onSelect }: {
  groups: Record<string, Marker>; selected?: string; onSelect: (marker: Marker) => void;
}) {
  const [camera, setCamera] = useState({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 });
  const [size, setSize] = useState({ width: MAP_WIDTH, height: MAP_HEIGHT });
  const surface = useRef<View>(null);
  const dragged = useRef(false);
  const scale = Math.min(size.width / MAP_WIDTH, size.height / MAP_HEIGHT) * camera.zoom;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const move = useCallback((dx: number, dy: number, factor = 1) => setCamera(current => {
    const zoom = Math.max(1, Math.min(32, current.zoom * factor));
    const halfW = MAP_WIDTH / zoom / 2;
    const halfH = MAP_HEIGHT / zoom / 2;
    return { zoom, x: Math.max(halfW, Math.min(MAP_WIDTH - halfW, current.x + dx)),
      y: Math.max(halfH, Math.min(MAP_HEIGHT - halfH, current.y + dy)) };
  }), []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = surface.current as unknown as HTMLElement;
    let start: { x: number; y: number; id: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragged.current = false;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const pan = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < 5) return;
      dragged.current = true;
      element.setPointerCapture(event.pointerId);
      move(-dx / scaleRef.current, -dy / scaleRef.current);
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const up = () => { start = null; };
    const wheel = (event: WheelEvent) => {
      // Keep ordinary page scrolling available. Modified wheel zooms the map.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      move(0, 0, event.deltaY < 0 ? 1.25 : 0.8);
    };
    const key = (event: KeyboardEvent) => {
      const steps: Record<string, [number, number]> = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] };
      if (steps[event.key]) { event.preventDefault(); move(steps[event.key][0] / scaleRef.current, steps[event.key][1] / scaleRef.current); }
      if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); move(0, 0, event.key === '-' ? 0.5 : 2); }
      if (event.key === 'Home') { event.preventDefault(); setCamera({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 }); }
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', pan);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', up);
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('keydown', key);
    return () => {
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', pan);
      element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up);
      element.removeEventListener('lostpointercapture', up); element.removeEventListener('wheel', wheel);
      element.removeEventListener('keydown', key);
    };
  }, [move]);
  const lastPan = useRef({ x: 0, y: 0 });
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 5,
    onPanResponderGrant: () => { lastPan.current = { x: 0, y: 0 }; dragged.current = true; },
    onPanResponderMove: (_, gesture) => {
      move((lastPan.current.x - gesture.dx) / scaleRef.current, (lastPan.current.y - gesture.dy) / scaleRef.current);
      lastPan.current = { x: gesture.dx, y: gesture.dy };
    },
    onPanResponderRelease: () => { dragged.current = false; },
  }), [move]);
  const radius = Math.max(9, 14 - Math.log2(camera.zoom)) / scale;
  const select = (group: Marker) => { if (!dragged.current) onSelect(group); };
  return <View>
    <View style={styles.mapControls}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom in" accessibilityState={{ disabled: camera.zoom === 32 }} disabled={camera.zoom === 32} style={styles.zoomButton} onPress={() => move(0, 0, 2)}><Text style={styles.zoomText}>+</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom out" accessibilityState={{ disabled: camera.zoom === 1 }} disabled={camera.zoom === 1} style={styles.zoomButton} onPress={() => move(0, 0, 0.5)}><Text style={styles.zoomText}>−</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset map view" style={styles.filterButton} onPress={() => setCamera({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 })}><Text style={styles.filterText}>Reset</Text></TouchableOpacity>
      <Text style={styles.legendItem} accessibilityLiveRegion="polite">{Math.round(camera.zoom * 100)}%</Text>
    </View>
    <View ref={surface} {...(Platform.OS === 'web' ? { tabIndex: 0 } : responder.panHandlers)}
      accessibilityLabel="World dive map. Drag to pan. Use arrow keys to pan, plus and minus to zoom, Home to reset."
      onLayout={event => setSize(event.nativeEvent.layout)} style={[styles.mapViewport, Platform.OS === 'web' && { touchAction: 'none', cursor: 'grab' } as any]}>
      <Svg style={styles.vectorMap} viewBox={`${camera.x - MAP_WIDTH / camera.zoom / 2} ${camera.y - MAP_HEIGHT / camera.zoom / 2} ${MAP_WIDTH / camera.zoom} ${MAP_HEIGHT / camera.zoom}`} preserveAspectRatio="xMidYMid meet">
        <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#c7e7ee" />
        {WORLD_FEATURES.map(feature => {
          const group = groups[feature.key];
          const active = group && group.country === selected;
          return <Path key={feature.key} d={feature.path} fill={active ? '#00A8A8' : group ? '#0077CC' : '#e9f5f7'} fillRule="evenodd" stroke="#8ab8c4" strokeWidth={0.65 / camera.zoom} onPress={group ? () => select(group) : undefined} />;
        })}
        {WORLD_FEATURES.map(feature => {
          const group = groups[feature.key];
          if (!group) return null;
          return <G key={feature.key} onPress={() => select(group)} accessibilityLabel={`${group.country}, ${group.dives.length} dives`}>
            <Circle cx={feature.center.x} cy={feature.center.y} r={radius} fill={group.country === selected ? '#007c7e' : '#0077CC'} stroke="#fff" strokeWidth={1.5 / scale} />
            <SvgText x={feature.center.x} y={feature.center.y + 4 / scale} fill="#fff" fontSize={11 / scale} fontWeight="bold" textAnchor="middle">{group.dives.length}</SvgText>
          </G>;
        })}
      </Svg>
    </View>
    <Text style={styles.legendItem}>Filled country = visited · Number = dives</Text>
    <Text style={styles.legendItem}>Drag to explore · + / − to zoom · Ctrl + scroll to zoom</Text>
    <View style={styles.filterRow}>
      {Object.values(groups).map(group => <TouchableOpacity key={canonicalCountryKey(group.country)} accessibilityRole="button" aria-pressed={group.country === selected} accessibilityState={{ selected: group.country === selected }} accessibilityLabel={`${group.country}, ${group.dives.length} dives`} style={[styles.filterButton, group.country === selected && styles.filterButtonSelected]} onPress={() => onSelect(group)}><Text style={styles.filterText}>{group.country} ({group.dives.length})</Text></TouchableOpacity>)}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  headingCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  headingActions: { alignItems: 'flex-end', gap: 8 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#555', marginTop: 4, fontSize: 15 },
  resultCount: { color: '#007c7e', fontWeight: 'bold', marginBottom: 4 },
  savedPill: { borderColor: '#00A8A8', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#effafa' },
  savedPillText: { color: '#007c7e', fontSize: 12, fontWeight: 'bold' },
  searchWrap: { position: 'relative' },
  searchInput: { backgroundColor: 'white', borderColor: '#0077CC', borderRadius: 24, borderWidth: 1, paddingLeft: 16, paddingRight: 48, paddingVertical: 13, fontSize: 16, color: '#222' },
  clearSearch: { position: 'absolute', right: 5, top: 4, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  clearSearchText: { color: '#0077CC', fontSize: 24, lineHeight: 24 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  filterActive: { backgroundColor: '#0077CC', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  filterActiveText: { color: 'white', fontWeight: 'bold' },
  filterButton: { minHeight: 44, justifyContent: 'center', flexShrink: 1, backgroundColor: 'white', borderColor: '#b8d8ee', borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  filterButtonSelected: { backgroundColor: '#d8f3f1', borderColor: '#00A8A8' },
  filterText: { color: '#0077CC', fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  statCard: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0, backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, borderColor: '#e1ecf2', borderWidth: 1 },
  statValue: { color: '#0077CC', fontSize: 20, fontWeight: 'bold' },
  statCardCompact: { flexBasis: '40%' },
  statLabel: { color: '#526b7a', fontSize: 11, marginTop: 3 },
  exploreToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, zIndex: 20 },
  viewToggle: { flexDirection: 'row', borderRadius: 12, backgroundColor: '#e5f0f4', padding: 3 },
  viewToggleButton: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 10 },
  viewToggleActive: { backgroundColor: 'white', shadowColor: '#0077CC', shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  viewToggleText: { color: '#5b7280', fontWeight: '600' },
  viewToggleTextActive: { color: '#0077CC' },
  sortWrap: { position: 'relative', zIndex: 25 },
  sortButton: { minWidth: 190, borderRadius: 12, borderWidth: 1, borderColor: '#c8dbe4', backgroundColor: 'white', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sortButtonText: { color: '#476273', fontSize: 12 },
  sortChevron: { color: '#0077CC', fontSize: 18, marginLeft: 8 },
  sortMenu: { position: 'absolute', right: 0, top: 45, width: 210, borderRadius: 12, backgroundColor: 'white', paddingVertical: 5, shadowColor: '#143b4c', shadowOpacity: 0.18, shadowRadius: 12, elevation: 6, zIndex: 50 },
  sortOption: { paddingHorizontal: 14, paddingVertical: 11 },
  sortOptionText: { color: '#476273', fontSize: 13 },
  mapViewport: { width: '100%', aspectRatio: MAP_WIDTH / MAP_HEIGHT, minHeight: 300, overflow: 'hidden', borderRadius: 20, backgroundColor: '#c7e7ee' },
  vectorMap: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  mapControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 },
  zoomButton: { width: 44, height: 44, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 10, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#0077CC', fontSize: 24, fontWeight: 'bold' },
  legendItem: { color: '#555', fontSize: 12, marginTop: 3 },
  popup: { marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#b8d8ee', backgroundColor: 'white' },
  popupAction: { minHeight: 44, justifyContent: 'center' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  popupTitle: { color: '#0077CC', fontSize: 16, fontWeight: 'bold' },
  popupText: { color: '#555', marginTop: 4 },
  popupDive: { color: '#4f6474', fontSize: 12, marginTop: 6 },
  popupLink: { color: '#007c7e', fontWeight: 'bold', marginTop: 10 },
  mapCredit: { color: '#526b7a', fontSize: 11, marginTop: 7, textAlign: 'right' },
  listHeading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: '#164c67', fontSize: 19, fontWeight: 'bold' },
  sectionHint: { color: '#526b7a', fontSize: 12 },
  siteList: { gap: 12 },
  siteCard: { minWidth: 0, backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2edf2', flexDirection: 'row', alignItems: 'center' },
  savedSiteCard: { borderColor: '#00A8A8', backgroundColor: '#f5ffff' },
  selectedSiteCard: { borderColor: '#0077CC', backgroundColor: '#edf8fb' },
  siteCardMain: { flex: 1, minWidth: 0 },
  siteName: { color: '#164c67', fontSize: 16, fontWeight: 'bold' },
  siteCountry: { color: '#0077CC', fontSize: 13, marginTop: 4 },
  siteMeta: { color: '#526b7a', fontSize: 12, marginTop: 9 },
  saveButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eaf4f7', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  saveIcon: { color: '#0077CC', fontSize: 26 },
  saveIconActive: { color: '#f4a62a' },
  emptyCard: { backgroundColor: 'white', borderRadius: 16, alignItems: 'center', padding: 28, borderWidth: 1, borderColor: '#e2edf2' },
  emptyTitle: { color: '#164c67', fontSize: 17, fontWeight: 'bold' },
  detailCard: { width: '100%', maxWidth: 640, alignSelf: 'center', marginTop: 18, backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#e2edf2', borderLeftWidth: 5, borderLeftColor: '#00A8A8' },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  detailEyebrow: { color: '#007c7e', textTransform: 'uppercase', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  detailTitle: { color: '#164c67', fontSize: 21, fontWeight: 'bold', marginTop: 3 },
  detailClose: { color: '#6e8794', fontSize: 26, lineHeight: 23, paddingHorizontal: 4 },
  detailCountry: { color: '#526b7a', marginTop: 7 },
  detailStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  detailStat: { color: '#0077CC', backgroundColor: '#edf8fb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  detailButton: { alignSelf: 'flex-end', marginTop: 16, backgroundColor: '#0077CC', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9 },
  detailButtonText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  unplacedText: { color: '#8b5e34', fontSize: 12, marginTop: 8, textAlign: 'right' },
  loader: { flex: 1 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 24 },
});
