import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import API from '../api/api';
import { Dive } from '../types';

type Marker = { country: string; dives: Dive[] };
type GeoGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
type GeoFeature = { properties?: { name?: string }; geometry: GeoGeometry };
type ViewMode = 'map' | 'list';
type SortKey = 'recent' | 'depth' | 'duration';

const MAP_WIDTH = 940;
const MAP_HEIGHT = 477;
const WORLD_GEOJSON = require('../assets/world.json') as { features: GeoFeature[] };

const COUNTRY_ALIASES: Record<string, string> = {
  espana: 'spain', francia: 'france', italia: 'italy', alemania: 'germany',
  reinounido: 'unitedkingdom', unitedkingdom: 'unitedkingdom', afganistan: 'afghanistan', grecia: 'greece',
  turquia: 'turkey', marruecos: 'morocco', egipto: 'egypt', sudafrica: 'southafrica',
  estadosunidosdeamerica: 'unitedstates', unitedstatesofamerica: 'unitedstates', usa: 'unitedstates',
  unitedstates: 'unitedstates', brasil: 'brazil',
  nuevazelanda: 'newzealand', japon: 'japan', pakistan: 'pakistan', tailandia: 'thailand',
  indonesia: 'indonesia', filipinas: 'philippines', rusia: 'russia', peru: 'peru',
  chile: 'chile', ecuador: 'ecuador', vietnam: 'vietnam', malasia: 'malaysia',
  singapur: 'singapore', maldivas: 'maldives', madagascar: 'madagascar', mauricio: 'mauritius',
  fiyi: 'fiji', papuanuevaguinea: 'papuanewguinea', belice: 'belize', costarica: 'costarica',
  panama: 'panama', honduras: 'honduras', guatemala: 'guatemala', republicadominicana: 'dominicanrepublic',
  bahamas: 'bahamas', thebahamas: 'bahamas', malta: 'malta', chipre: 'cyprus', croacia: 'croatia', eslovenia: 'slovenia',
  montenegro: 'montenegro', bosniayherzegovina: 'bosniaandherzegovina', oman: 'oman',
  emiratosarabesunidos: 'unitedarabemirates', arabiasaudi: 'saudiarabia', saudiarabia: 'saudiarabia', jordania: 'jordan',
  kenia: 'kenya', tanzania: 'tanzania', unitedrepublicoftanzania: 'tanzania', mozambique: 'mozambique', comoras: 'comoros',
  bangladesh: 'bangladesh', srilanka: 'srilanka', myanmar: 'myanmar', camboya: 'cambodia',
  laos: 'laos', brunei: 'brunei', taiwan: 'taiwan',
  easttimor: 'timorleste', timorleste: 'timorleste',
  england: 'unitedkingdom',
  republicofserbia: 'serbia', serbia: 'serbia',
  republicofthecongo: 'congo', democraticrepublicofthecongo: 'congo', congo: 'congo',
  macedonia: 'northmacedonia', northmacedonia: 'northmacedonia',
  swaziland: 'eswatini', eswatini: 'eswatini',
};

const countryKey = (value: string) => (value || '').toLocaleLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

const canonicalCountryKey = (value: string) => COUNTRY_ALIASES[countryKey(value)] || countryKey(value);

const normalizeSearchText = (value: string) => (value || '').toLocaleLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

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
  let bestPoints: number[][] = [];
  if (geometry.type === 'Polygon') {
    bestPoints = geometry.coordinates[0] || [];
  } else {
    let maxArea = -1;
    for (const polygon of geometry.coordinates) {
      const ring = polygon[0] || [];
      let area = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        area += (ring[i][0] * ring[i + 1][1]) - (ring[i + 1][0] * ring[i][1]);
      }
      area = Math.abs(area);
      if (area > maxArea) {
        maxArea = area;
        bestPoints = ring;
      }
    }
  }
  if (!bestPoints.length) return project(0, 0);
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < bestPoints.length - 1; i++) {
    const p1 = bestPoints[i], p2 = bestPoints[i + 1];
    const f = (p1[0] * p2[1]) - (p2[0] * p1[1]);
    area += f;
    cx += (p1[0] + p2[0]) * f;
    cy += (p1[1] + p2[1]) * f;
  }
  area = area * 0.5;
  if (Math.abs(area) < 1e-6) {
    const totals = bestPoints.reduce((sum, point) => ({ longitude: sum.longitude + point[0], latitude: sum.latitude + point[1] }), { longitude: 0, latitude: 0 });
    return project(totals.longitude / bestPoints.length, totals.latitude / bestPoints.length);
  }
  return project(cx / (6 * area), cy / (6 * area));
};

const WORLD_FEATURES = WORLD_GEOJSON.features.map((feature, index) => ({
  ...feature,
  name: feature.properties?.name || `country-${index}`,
  key: canonicalCountryKey(feature.properties?.name || `country-${index}`),
  path: geometryToPath(feature.geometry),
  center: geometryCenter(feature.geometry),
}));

export default function DiveMapScreen({ navigation }: any) {
  const { width: windowWidth } = useWindowDimensions();
  const [dives, setDives] = useState<Dive[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'Spain' | 'Portugal' | 'Mexico'>('all');
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [selectedDive, setSelectedDive] = useState<Dive | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [savedSites, setSavedSites] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [legendOpen, setLegendOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const panRef = useRef({ x: 0, y: 0 });
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    API.get('/dives/my')
      .then((response) => setDives(response.data))
      .catch(() => setDives([]))
      .finally(() => setLoading(false));
  }, []);

  const selectFilter = (filter: 'all' | 'Spain' | 'Portugal' | 'Mexico') => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setQuery('');
    } else {
      setQuery(filter);
    }
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    const trimmed = text.trim();
    if (!trimmed) {
      setActiveFilter('all');
    } else if (trimmed.toLowerCase() === 'spain' || trimmed.toLowerCase() === 'españa' || trimmed.toLowerCase() === 'espana') {
      setActiveFilter('Spain');
    } else if (trimmed.toLowerCase() === 'portugal') {
      setActiveFilter('Portugal');
    } else if (trimmed.toLowerCase() === 'mexico' || trimmed.toLowerCase() === 'méxico') {
      setActiveFilter('Mexico');
    } else {
      setActiveFilter('all');
    }
  };

  const filteredDives = useMemo(() => {
    const rawTerm = query.trim();
    const normalizedTerm = normalizeSearchText(rawTerm);
    const targetCanonical = canonicalCountryKey(rawTerm);

    return dives.filter((dive) => {
      if (showSavedOnly && !savedSites.includes(dive.location)) {
        return false;
      }
      if (!rawTerm) return true;

      const diveCountryNorm = normalizeSearchText(dive.country || '');
      const diveLocationNorm = normalizeSearchText(dive.location || '');
      const diveCanonical = canonicalCountryKey(dive.country || '');

      if (targetCanonical && diveCanonical && targetCanonical === diveCanonical) {
        return true;
      }
      return (
        diveCountryNorm.includes(normalizedTerm) ||
        diveLocationNorm.includes(normalizedTerm)
      );
    });
  }, [dives, query, savedSites, showSavedOnly]);

  const groupedDives = useMemo(() => filteredDives.reduce<Record<string, Dive[]>>((groups, dive) => {
    groups[dive.country] = [...(groups[dive.country] || []), dive];
    return groups;
  }, {}), [filteredDives]);

  const countryGroups = useMemo(() => Object.entries(groupedDives).reduce<Record<string, Marker>>((groups, [country, countryDives]) => {
    groups[canonicalCountryKey(country)] = { country, dives: countryDives };
    return groups;
  }, {}), [groupedDives]);

  const sortedDives = useMemo(() => {
    return [...filteredDives].sort((a, b) => {
      if (sortKey === 'depth') return Number(b.maxDepth || 0) - Number(a.maxDepth || 0);
      if (sortKey === 'duration') return Number(b.duration || 0) - Number(a.duration || 0);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filteredDives, sortKey]);

  const averageDepth = filteredDives.length
    ? Math.round(filteredDives.reduce((total, dive) => total + Number(dive.maxDepth || 0), 0) / filteredDives.length)
    : 0;
  const savedCount = dives.filter((dive) => savedSites.includes(dive.location)).length;
  const sortLabels: Record<SortKey, string> = { recent: 'Most recent', depth: 'Deepest first', duration: 'Longest first' };

  const handleZoomChange = (delta: number) => {
    setZoom((curr) => {
      const next = Math.max(0.75, Math.min(3, +(curr + delta).toFixed(2)));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      } else {
        const maxPanX = ((next - 1) * MAP_WIDTH) / 2;
        const maxPanY = ((next - 1) * MAP_HEIGHT) / 2;
        setPan((p) => ({
          x: Math.max(-maxPanX, Math.min(maxPanX, p.x)),
          y: Math.max(-maxPanY, Math.min(maxPanY, p.y)),
        }));
      }
      return next;
    });
  };

  const panResponder = useMemo(() => {
    let startX = 0;
    let startY = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => zoomRef.current > 1,
      onMoveShouldSetPanResponder: (_, gesture) =>
        zoomRef.current > 1 && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
      onPanResponderGrant: () => {
        startX = panRef.current.x;
        startY = panRef.current.y;
      },
      onPanResponderMove: (_, gesture) => {
        const currentZoom = zoomRef.current;
        if (currentZoom <= 1) return;
        const maxPanX = ((currentZoom - 1) * MAP_WIDTH) / 2;
        const maxPanY = ((currentZoom - 1) * MAP_HEIGHT) / 2;
        const nextX = Math.max(-maxPanX, Math.min(maxPanX, startX + gesture.dx));
        const nextY = Math.max(-maxPanY, Math.min(maxPanY, startY + gesture.dy));
        setPan({ x: nextX, y: nextY });
      },
    });
  }, []);

  const isNarrow = windowWidth < 640;

  const toggleSaved = (dive: Dive) => {
    setSavedSites((current) => current.includes(dive.location)
      ? current.filter((location) => location !== dive.location)
      : [...current, dive.location]);
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
          <Text style={styles.title}>Dive sites</Text>
          <Text style={styles.subtitle}>Explore, compare and revisit the places in your logbook</Text>
        </View>
        <View style={styles.headingActions}>
          <TouchableOpacity style={styles.savedPill} onPress={() => setShowSavedOnly((value) => !value)}>
            <Text style={styles.savedPillText}>☆ {savedCount} saved</Text>
          </TouchableOpacity>
          <Text style={styles.resultCount}>{filteredDives.length} dives</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search by site or country"
          accessibilityLabel="Search dive sites"
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearch}
            onPress={() => {
              setQuery('');
              setActiveFilter('all');
            }}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearSearchText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.filterRow, Platform.OS === 'web' && styles.webFilterRow]}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'all' && !showSavedOnly && styles.filterActive]}
          onPress={() => selectFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && !showSavedOnly && styles.filterActiveText]}>All sites</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'Spain' && styles.filterActive]}
          onPress={() => selectFilter('Spain')}
        >
          <Text style={[styles.filterText, activeFilter === 'Spain' && styles.filterActiveText]}>Spain</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'Portugal' && styles.filterActive]}
          onPress={() => selectFilter('Portugal')}
        >
          <Text style={[styles.filterText, activeFilter === 'Portugal' && styles.filterActiveText]}>Portugal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'Mexico' && styles.filterActive]}
          onPress={() => selectFilter('Mexico')}
        >
          <Text style={[styles.filterText, activeFilter === 'Mexico' && styles.filterActiveText]}>Mexico</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, showSavedOnly && styles.filterActive]}
          onPress={() => setShowSavedOnly((value) => !value)}
        >
          <Text style={[styles.filterText, showSavedOnly && styles.filterActiveText]}>Saved</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}><Text style={styles.statValue}>{filteredDives.length}</Text><Text style={styles.statLabel}>Logged dives</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{Object.keys(countryGroups).length}</Text><Text style={styles.statLabel}>Countries</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{averageDepth}m</Text><Text style={styles.statLabel}>Average max depth</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{savedCount}</Text><Text style={styles.statLabel}>Saved sites</Text></View>
      </View>

      <View style={styles.exploreToolbar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleActive]} onPress={() => setViewMode('map')}><Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>Map</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]} onPress={() => setViewMode('list')}><Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>List</Text></TouchableOpacity>
        </View>
        <View style={styles.sortWrap}>
          <TouchableOpacity style={styles.sortButton} onPress={() => setSortMenuOpen((value) => !value)}><Text style={styles.sortButtonText}>Sort: {sortLabels[sortKey]}</Text><Text style={styles.sortChevron}>⌄</Text></TouchableOpacity>
          {sortMenuOpen && <View style={styles.sortMenu}>
            {(Object.keys(sortLabels) as SortKey[]).map((key) => <TouchableOpacity key={key} style={styles.sortOption} onPress={() => { setSortKey(key); setSortMenuOpen(false); }}><Text style={styles.sortOptionText}>{sortLabels[key]}</Text></TouchableOpacity>)}
          </View>}
        </View>
      </View>

      {viewMode === 'map' && <>
        <View style={[styles.mapViewport, Platform.OS === 'web' && styles.webMapViewport]}>
          {loading ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : (
            <>
              <View
                style={[
                  styles.mapCanvas,
                  Platform.OS === 'web' && styles.webMapCanvas,
                  {
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y },
                      { scale: zoom },
                    ],
                  },
                ]}
                {...panResponder.panHandlers}
              >
                <Svg style={styles.vectorMap} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" accessibilityLabel="Interactive vector world map">
                  <Rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#c7e7ee" />
                  {WORLD_FEATURES.map((feature) => {
                    const group = countryGroups[feature.key];
                    const selected = group && group.country === selectedMarker?.country;
                    return (
                      <Path
                        key={feature.name}
                        d={feature.path}
                        fill={selected ? '#00A8A8' : group ? '#0077CC' : '#e9f5f7'}
                        fillRule="evenodd"
                        stroke={selected ? '#006f70' : '#8ab8c4'}
                        strokeWidth={(selected ? 1.4 : 0.65) / zoom}
                        onPress={group ? () => setSelectedMarker(group) : undefined}
                        accessibilityLabel={group ? `${feature.name}, ${group.dives.length} logged dives` : feature.name}
                      />
                    );
                  })}
                  {Object.values(countryGroups).map((group) => {
                    const feature = WORLD_FEATURES.find((item) => item.key === canonicalCountryKey(group.country));
                    if (!feature) return null;
                    const markerRadius = (6 + 6 / zoom) / zoom;
                    const strokeWidth = 1.5 / zoom;
                    const fontSize = (6 + 5 / zoom) / zoom;
                    const textYOffset = (2 + 2 / zoom) / zoom;
                    return (
                      <G key={`count-${group.country}`} onPress={() => setSelectedMarker(group)}>
                        <Circle
                          cx={feature.center.x}
                          cy={feature.center.y}
                          r={markerRadius}
                          fill="#0077CC"
                          stroke="#fff"
                          strokeWidth={strokeWidth}
                        />
                        <SvgText
                          x={feature.center.x}
                          y={feature.center.y + textYOffset}
                          fill="#fff"
                          fontSize={fontSize}
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {group.dives.length}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>

              <View style={styles.zoomControls}>
                <TouchableOpacity accessibilityLabel="Zoom in" style={styles.zoomButton} onPress={() => handleZoomChange(0.25)}>
                  <Text style={styles.zoomText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Zoom out" style={styles.zoomButton} onPress={() => handleZoomChange(-0.25)}>
                  <Text style={styles.zoomText}>−</Text>
                </TouchableOpacity>
              </View>

              {isNarrow ? (
                <View style={styles.legendContainerNarrow}>
                  <TouchableOpacity
                    style={styles.legendToggle}
                    onPress={() => setLegendOpen((v) => !v)}
                    accessibilityLabel={legendOpen ? 'Hide map legend' : 'Show map legend'}
                  >
                    <Text style={styles.legendToggleText}>{legendOpen ? 'Legend ▴' : 'Legend ▾'}</Text>
                  </TouchableOpacity>
                  {legendOpen && (
                    <View style={styles.legendContentNarrow}>
                      <Text style={styles.legendItem}>Filled country = visited</Text>
                      <Text style={styles.legendItem}>Number = dives</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.legend}>
                  <Text style={styles.legendTitle}>Legend</Text>
                  <Text style={styles.legendItem}>Filled country = visited</Text>
                  <Text style={styles.legendItem}>Number = dives</Text>
                </View>
              )}

              {selectedMarker && (
                <View style={[styles.popup, Platform.OS === 'web' && styles.webPopup]}>
                  <View style={styles.popupHeader}>
                    <Text style={styles.popupTitle}>{selectedMarker.country}</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedMarker(null)}
                      accessibilityLabel="Close marker popup"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.popupClose}>×</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.popupText}>{selectedMarker.dives.length} logged dive{selectedMarker.dives.length === 1 ? '' : 's'}</Text>
                  {selectedMarker.dives.slice(0, 2).map((dive) => (
                    <TouchableOpacity key={dive.id} onPress={() => openDive(dive)}>
                      <Text style={styles.popupDive} numberOfLines={1}>{dive.location}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => navigation.navigate('DiveDetail', { diveId: selectedMarker.dives[0].id })}>
                    <Text style={styles.popupLink}>View latest dive</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
        <Text style={styles.mapCredit}>Vector borders: GeoJSON world country boundaries</Text>
      </>}

      <View style={styles.listHeading}><Text style={styles.sectionTitle}>{viewMode === 'map' ? 'Recent dive sites' : 'All logged sites'}</Text><Text style={styles.sectionHint}>{sortedDives.length} shown</Text></View>
      {sortedDives.length > 0 ? <View style={styles.siteList}>
        {sortedDives.map((dive, index) => {
          const saved = savedSites.includes(dive.location);
          return <TouchableOpacity key={`${dive.id}-${index}`} style={[styles.siteCard, saved && styles.savedSiteCard]} onPress={() => openDive(dive)}>
            <View style={styles.siteCardMain}><Text style={styles.siteName} numberOfLines={1}>{dive.location}</Text><Text style={styles.siteCountry}>{dive.country}</Text><Text style={styles.siteMeta}>{new Date(dive.date).toLocaleDateString()} · {dive.maxDepth || 0}m · {dive.duration || 0} min</Text></View>
            <TouchableOpacity style={styles.saveButton} onPress={() => toggleSaved(dive)} accessibilityLabel={saved ? `Remove ${dive.location} from saved sites` : `Save ${dive.location}`}><Text style={[styles.saveIcon, saved && styles.saveIconActive]}>{saved ? '★' : '☆'}</Text></TouchableOpacity>
          </TouchableOpacity>;
        })}
      </View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No sites to show</Text><Text style={styles.emptyText}>Try a different search or clear your saved filter.</Text></View>}

      {selectedDive && <View style={styles.detailCard}>
        <View style={styles.detailHeader}><View><Text style={styles.detailEyebrow}>Selected dive</Text><Text style={styles.detailTitle}>{selectedDive.location}</Text></View><TouchableOpacity onPress={() => setSelectedDive(null)}><Text style={styles.detailClose}>×</Text></TouchableOpacity></View>
        <Text style={styles.detailCountry}>{selectedDive.country} · {new Date(selectedDive.date).toLocaleDateString()}</Text>
        <View style={styles.detailStats}><Text style={styles.detailStat}>{selectedDive.maxDepth || 0}m max depth</Text><Text style={styles.detailStat}>{selectedDive.duration || 0} min underwater</Text></View>
        <TouchableOpacity style={styles.detailButton} onPress={() => navigation.navigate('DiveDetail', { diveId: selectedDive.id })}><Text style={styles.detailButtonText}>Open dive log</Text></TouchableOpacity>
      </View>}

      {unplacedCountries.length > 0 && <Text style={styles.unplacedText}>No map shape for: {unplacedCountries.join(', ')}</Text>}
      {!loading && filteredDives.length === 0 && <Text style={styles.emptyText}>No dive sites match your search.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  headingCopy: { flex: 1 },
  headingActions: { alignItems: 'flex-end', gap: 8 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#555', marginTop: 4, fontSize: 15 },
  resultCount: { color: '#00A8A8', fontWeight: 'bold', marginBottom: 4 },
  savedPill: { borderColor: '#00A8A8', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#effafa' },
  savedPillText: { color: '#007c7e', fontSize: 12, fontWeight: 'bold' },
  searchWrap: { position: 'relative' },
  searchInput: { backgroundColor: 'white', borderColor: '#0077CC', borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, color: '#222' },
  clearSearch: { position: 'absolute', right: 5, top: 4, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  clearSearchText: { color: '#0077CC', fontSize: 24, lineHeight: 24 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  webFilterRow: { flexWrap: 'wrap', width: '100%' },
  filterActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  filterActiveText: { color: 'white' },
  filterButton: { backgroundColor: 'white', borderColor: '#b8d8ee', borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  filterText: { color: '#0077CC', fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    minWidth: 130,
    borderColor: '#e1ecf2',
    borderWidth: 1,
    shadowColor: '#143b4c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { color: '#0077CC', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#6a7d8d', fontSize: 11, marginTop: 3 },
  exploreToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, zIndex: 20 },
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
  mapViewport: { width: '100%', aspectRatio: MAP_WIDTH / MAP_HEIGHT, borderRadius: 20, backgroundColor: '#d7edf5', position: 'relative', overflow: 'hidden' },
  webMapViewport: { overflow: 'hidden' },
  mapCanvas: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 20, backgroundColor: '#c7e7ee' },
  webMapCanvas: { width: '100%', cursor: 'grab' as any },
  vectorMap: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  zoomControls: { position: 'absolute', left: 14, top: 14, zIndex: 30, gap: 6 },
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomText: { color: '#0077CC', fontSize: 24, fontWeight: 'bold' },
  legend: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 30,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    width: 155,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: { color: '#0077CC', fontWeight: 'bold', marginBottom: 5 },
  legendItem: { color: '#555', fontSize: 12, marginTop: 3 },
  legendContainerNarrow: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  legendToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  legendToggleText: {
    color: '#0077CC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  legendContentNarrow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  popup: {
    position: 'absolute',
    left: '50%',
    bottom: 16,
    transform: [{ translateX: -120 }],
    width: 240,
    maxWidth: '90%',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'white',
    zIndex: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  webPopup: { bottom: 16 },
  popupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  popupClose: { color: '#6e8794', fontSize: 22, fontWeight: 'bold', lineHeight: 22, paddingHorizontal: 4 },
  popupTitle: { color: '#0077CC', fontSize: 16, fontWeight: 'bold', flex: 1, minWidth: 0 },
  popupText: { color: '#555', marginTop: 4 },
  popupDive: { color: '#4f6474', fontSize: 12, marginTop: 6 },
  popupLink: { color: '#00A8A8', fontWeight: 'bold', marginTop: 10 },
  mapCredit: { color: '#738494', fontSize: 11, marginTop: 7, textAlign: 'right' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: '#164c67', fontSize: 19, fontWeight: 'bold' },
  sectionHint: { color: '#8497a4', fontSize: 12 },
  siteList: { gap: 12 },
  siteCard: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2edf2',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#164c67',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  savedSiteCard: {
    borderColor: '#00A8A8',
    backgroundColor: '#f5ffff',
    shadowColor: '#00A8A8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  siteCardMain: { flex: 1, minWidth: 0 },
  siteName: { color: '#164c67', fontSize: 16, fontWeight: 'bold' },
  siteCountry: { color: '#0077CC', fontSize: 13, marginTop: 4 },
  siteMeta: { color: '#80929d', fontSize: 12, marginTop: 9 },
  saveButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eaf4f7', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  saveIcon: { color: '#0077CC', fontSize: 26 },
  saveIconActive: { color: '#f4a62a' },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2edf2',
    shadowColor: '#143b4c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: { color: '#164c67', fontSize: 17, fontWeight: 'bold' },
  detailCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderLeftWidth: 5,
    borderLeftColor: '#00A8A8',
    borderWidth: 1,
    borderColor: '#e2edf2',
    shadowColor: '#164c67',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  detailEyebrow: { color: '#00A8A8', textTransform: 'uppercase', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  detailTitle: { color: '#164c67', fontSize: 21, fontWeight: 'bold', marginTop: 3 },
  detailClose: { color: '#6e8794', fontSize: 26, lineHeight: 23, paddingHorizontal: 4 },
  detailCountry: { color: '#6e8794', marginTop: 7 },
  detailStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  detailStat: { color: '#0077CC', backgroundColor: '#edf8fb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  detailButton: { alignSelf: 'flex-end', marginTop: 16, backgroundColor: '#0077CC', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9 },
  detailButtonText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  unplacedText: { color: '#8b5e34', fontSize: 12, marginTop: 8, textAlign: 'right' },
  loader: { flex: 1 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 24 },
});
