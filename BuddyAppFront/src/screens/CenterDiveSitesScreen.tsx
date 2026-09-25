import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import API from '../api/api';
import { DiveSite, OperationMapTemplate, PokedexSpecies } from '../types';

const MAP_WIDTH = 900;
const MAP_HEIGHT = 470;
type GeoGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
type GeoFeature = { properties?: { adm3_en?: string; name?: string }; geometry: GeoGeometry };
const BOHOL_GEOJSON = require('../assets/bohol.json') as { features: GeoFeature[] };
const BOHOL_FEATURES = BOHOL_GEOJSON.features.map((feature, index) => ({
  ...feature,
  name: feature.properties?.adm3_en || feature.properties?.name || `Bohol area ${index + 1}`,
}));
const emptyForm = { name: '', description: '', latitude: '9.60', longitude: '123.78', minDepth: '', maxDepth: '', difficulty: 'Intermediate', currentInfo: '', highlights: '', routeName: '', routeNotes: '', routePoints: '' };
type Form = typeof emptyForm;

const project = (latitude: number, longitude: number, map: OperationMapTemplate) => ({
  x: ((longitude - map.bounds.west) / (map.bounds.east - map.bounds.west)) * MAP_WIDTH,
  y: ((map.bounds.north - latitude) / (map.bounds.north - map.bounds.south)) * MAP_HEIGHT,
});

const ringToPath = (ring: number[][], map: OperationMapTemplate) => ring.map(([longitude, latitude], index) => {
  const point = project(latitude, longitude, map);
  return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}).join(' ') + ' Z';

const geometryToPath = (geometry: GeoGeometry, map: OperationMapTemplate) => {
  if (geometry.type === 'Polygon') return geometry.coordinates.map((ring: number[][]) => ringToPath(ring, map)).join(' ');
  return geometry.coordinates.flatMap((polygon: number[][][]) => polygon.map((ring) => ringToPath(ring, map))).join(' ');
};

const geometryCenter = (geometry: GeoGeometry, map: OperationMapTemplate) => {
  const points: number[][] = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0]?.[0] || [];
  if (!points.length) return { x: 0, y: 0 };
  const totals = points.reduce((sum, point) => ({ longitude: sum.longitude + point[0], latitude: sum.latitude + point[1] }), { longitude: 0, latitude: 0 });
  return project(totals.latitude / points.length, totals.longitude / points.length, map);
};

const parseList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const parsePoints = (value: string) => value.split(';').map((pair) => {
  const [latitude, longitude, ...label] = pair.split(',').map((part) => part.trim());
  return { latitude: Number(latitude), longitude: Number(longitude), ...(label.length ? { label: label.join(', ') } : {}) };
}).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

export default function CenterDiveSitesScreen({ navigation }: any) {
  const [catalog, setCatalog] = useState<OperationMapTemplate[]>([]);
  const [speciesCatalog, setSpeciesCatalog] = useState<PokedexSpecies[]>([]);
  const [map, setMap] = useState<OperationMapTemplate | null>(null);
  const [selectedMapKey, setSelectedMapKey] = useState<string | null>(null);
  const [sites, setSites] = useState<DiveSite[]>([]);
  const [selected, setSelected] = useState<DiveSite | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<DiveSite | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [selectedTypicalSightings, setSelectedTypicalSightings] = useState<string[]>([]);
  const [sightingQuery, setSightingQuery] = useState('');
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await API.get('/center/operation-map');
      setCatalog(Array.isArray(response.data.catalog) ? response.data.catalog : []);
      setMap(response.data.map || null);
      setSelectedMapKey(response.data.selectedMapKey || null);
      setSites(Array.isArray(response.data.sites) ? response.data.sites : []);
      setSelected(null);
      try {
        const speciesResponse = await API.get<PokedexSpecies[]>('/pokedex/species');
        setSpeciesCatalog(Array.isArray(speciesResponse.data) ? speciesResponse.data : []);
      } catch { setSpeciesCatalog([]); }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not load the operation map.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visibleSites = useMemo(() => {
    const value = query.trim().toLowerCase();
    return sites.filter((site) => !value || `${site.name} ${site.description || ''} ${site.difficulty || ''} ${(site.typicalSightings || []).map((key) => speciesCatalog.find((species) => species.key === key)?.name || key).join(' ')}`.toLowerCase().includes(value));
  }, [query, sites, speciesCatalog]);

  const filteredSightings = useMemo(() => {
    const value = sightingQuery.trim().toLocaleLowerCase();
    return speciesCatalog.filter((species) => !value || `${species.name} ${species.category}`.toLocaleLowerCase().includes(value));
  }, [sightingQuery, speciesCatalog]);

  const speciesForKey = (key: string) => speciesCatalog.find((species) => species.key === key);
  const normalizeSightings = (values: string[]) => values.map((value) => speciesCatalog.find((species) => species.key === value || species.name === value)?.key || value);

  const setField = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));

  };
  const chooseMap = async (mapKey: string) => {
    setSaving(true); setError('');
    try {
      const response = await API.patch('/center/operation-map', { mapKey });
      setMap(response.data.map || null); setSelectedMapKey(response.data.selectedMapKey || mapKey); setSites(response.data.sites || []); setSelected(null);
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Could not select this operation map.'); }
    finally { setSaving(false); }
  };

  const openCreate = (coordinates?: { latitude: number; longitude: number }) => {
    setEditing(null); setForm({ ...emptyForm, ...(coordinates ? { latitude: coordinates.latitude.toFixed(5), longitude: coordinates.longitude.toFixed(5) } : {}) }); setSelectedTypicalSightings([]); setSightingQuery(''); setSpeciesPickerOpen(false); setError(''); setModal(true); setPlacing(false);
  };
  const openEdit = (site: DiveSite) => {
    const route = site.routes?.[0];
    setEditing(site); setSelectedTypicalSightings(normalizeSightings(site.typicalSightings || [])); setSightingQuery(''); setSpeciesPickerOpen(false); setForm({
      ...emptyForm,
      name: site.name,
      description: site.description || '',
      latitude: String(site.latitude), longitude: String(site.longitude),
      minDepth: site.minDepth == null ? '' : String(site.minDepth), maxDepth: site.maxDepth == null ? '' : String(site.maxDepth),
      difficulty: site.difficulty || 'Intermediate', currentInfo: site.currentInfo || '',
      highlights: (site.highlights || []).join(', '),
      routeName: route?.name || '', routeNotes: route?.notes || '', routePoints: route?.points?.map((point) => [point.latitude, point.longitude, point.label].filter((value) => value != null && value !== '').join(', ')).join('; ') || '',
    });
    setError(''); setModal(true);
  };

  const saveSite = async () => {
    if (!form.name.trim() || !map) { setError('Choose a map and enter a dive site name.'); return; }
    const latitude = Number(form.latitude); const longitude = Number(form.longitude);
    if (!form.latitude.trim() || !form.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < map.bounds.south || latitude > map.bounds.north || longitude < map.bounds.west || longitude > map.bounds.east) { setError('Enter coordinates inside the selected operation map.'); return; }
    if ([form.minDepth, form.maxDepth].some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 200)) || (form.minDepth.trim() && form.maxDepth.trim() && Number(form.minDepth) > Number(form.maxDepth))) {
      setError('Enter depths from 0 to 200 m, with minimum no greater than maximum.'); return;
    }
    if (form.routePoints.trim() && form.routePoints.split(';').some((pair) => {
      const [lat, lon] = pair.split(',').map((part) => part.trim());
      return !lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180;
    })) { setError('Each waypoint needs a valid latitude and longitude.'); return; }
    if (form.routePoints.trim() && !form.routeName.trim()) { setError('Enter a name for the route.'); return; }
    setSaving(true); setError('');
    const routes = form.routeName.trim() ? [{ name: form.routeName.trim(), notes: form.routeNotes.trim() || undefined, points: parsePoints(form.routePoints) }] : [];
    const payload = { mapKey: map.key, name: form.name.trim(), description: form.description.trim() || null, latitude, longitude, minDepth: form.minDepth.trim() ? Number(form.minDepth) : null, maxDepth: form.maxDepth.trim() ? Number(form.maxDepth) : null, difficulty: form.difficulty.trim() || null, currentInfo: form.currentInfo.trim() || null, highlights: parseList(form.highlights), typicalSightings: normalizeSightings(selectedTypicalSightings), routes: [...routes, ...(editing?.routes?.slice(1) || [])] };
    try {
      const response = editing ? await API.patch(`/center/dive-sites/${editing.id}`, payload) : await API.post('/center/dive-sites', payload);
      const next = response.data as DiveSite;
      setSites((current) => editing ? current.map((site) => site.id === next.id ? next : site) : [...current, next].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(next); setModal(false);
    } catch (requestError: any) { const message = requestError?.response?.data?.message; setError(Array.isArray(message) ? message.join(' ') : message || 'Could not save this dive site.'); }
    finally { setSaving(false); }
  };

  const removeSite = async (site: DiveSite) => {
    if (Platform.OS === 'web' && !window.confirm(`Remove ${site.name}? This cannot be undone.`)) return;
    setSaving(true); setError('');
    try { await API.delete(`/center/dive-sites/${site.id}`); setSites((current) => current.filter((candidate) => candidate.id !== site.id)); setSelected(null); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Could not remove this dive site.'); }
    finally { setSaving(false); }
  };

  const handleMapPress = (point: { x: number; y: number }) => {
    if (!placing || !map) return;
    openCreate({
      latitude: map.bounds.north - point.y / MAP_HEIGHT * (map.bounds.north - map.bounds.south),
      longitude: map.bounds.west + point.x / MAP_WIDTH * (map.bounds.east - map.bounds.west),
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#123b52" /><Text style={styles.muted}>Loading operation map…</Text></View>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.eyebrow}>CENTER OPERATIONS</Text><Text style={styles.title}>Dive sites map</Text><Text style={styles.subtitle}>Build a local guide for your center and share the best routes with divers.</Text></View><View style={styles.heroBadge}><Text style={styles.heroValue}>{sites.length}</Text><Text style={styles.heroLabel}>sites mapped</Text></View></View>
    {error ? <View><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={load} style={styles.editButton}><Text style={styles.editButtonText}>Retry loading map</Text></TouchableOpacity></View> : null}
    <View style={styles.mapChoice}><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Operation area</Text><Text style={styles.sectionHint}>Choose the coastal map where your center operates. More regions can be added later.</Text></View><View style={styles.mapOptions}>{catalog.map((candidate) => <TouchableOpacity key={candidate.key} disabled={saving} accessibilityRole="button" accessibilityState={{ selected: selectedMapKey === candidate.key }} onPress={() => chooseMap(candidate.key)} style={[styles.mapOption, selectedMapKey === candidate.key && styles.mapOptionActive]}><Text style={styles.mapOptionTitle}>{candidate.name}</Text><Text style={styles.mapOptionMeta}>{candidate.country}</Text></TouchableOpacity>)}</View></View>
    {map ? <>
      <View style={styles.toolbar}><View style={styles.searchBox}><TextInput accessibilityLabel="Search dive sites" placeholder="Search dive sites, wildlife or difficulty" value={query} onChangeText={setQuery} style={styles.searchInput} /></View><TouchableOpacity accessibilityRole="button" style={[styles.placeButton, placing && styles.placeButtonActive]} onPress={() => setPlacing((current) => !current)}><Text style={styles.placeButtonText}>{placing ? 'Click map to place…' : '+ Place pin'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.addButton} onPress={() => openCreate()}><Text style={styles.addButtonText}>Add details</Text></TouchableOpacity></View>
      <View style={styles.mapPanel}><View style={styles.mapPanelHeader}><View style={{ flexBasis: 280, flexGrow: 1, flexShrink: 1 }}><Text style={styles.sectionTitle}>{map.name}</Text><Text style={styles.sectionHint}>{placing ? 'Click anywhere inside the map to set a new pin.' : 'Select a pin or card. Zoom and drag to explore; arrow keys also pan.'}</Text></View><Text style={styles.attribution}>{map.attribution}</Text></View><View style={styles.mapFrame}><PanglaoMap key={map.key} map={map} sites={visibleSites} selectedId={selected?.id} placing={placing} onSelect={(site) => { setSelected(site); setPlacing(false); }} onMapPress={handleMapPress} /></View></View>
      <View style={styles.resultsHeader}><Text style={styles.sectionTitle}>Dive zones</Text><Text style={styles.sectionHint}>{visibleSites.length} shown</Text></View>
      <View style={styles.siteGrid}>{visibleSites.map((site) => <TouchableOpacity key={site.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === site.id }} style={[styles.siteCard, selected?.id === site.id && styles.siteCardActive]} onPress={() => setSelected(site)}><View style={styles.siteCardTop}><Text style={styles.siteName}>{site.name}</Text><Text style={styles.difficulty}>{site.difficulty || 'Unrated'}</Text></View><Text numberOfLines={2} style={styles.siteDescription}>{site.description || 'No description yet.'}</Text><Text style={styles.siteMeta}>{site.minDepth ?? '?'}–{site.maxDepth ?? '?'} m · {(site.typicalSightings || []).length} typical sightings · {(site.routes || []).length} route{(site.routes || []).length === 1 ? '' : 's'}</Text></TouchableOpacity>)}</View>
      {!visibleSites.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No dive zones match</Text><Text style={styles.muted}>Try another search or place your first pin.</Text></View> : null}
      {selected ? <View style={styles.detailPanel}><View style={styles.detailCopy}><Text style={styles.eyebrow}>SELECTED DIVE ZONE</Text><Text style={styles.detailTitle}>{selected.name}</Text><Text style={styles.detailDescription}>{selected.description || 'Add a description so visiting divers know what to expect.'}</Text><Text style={styles.detailMeta}>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)} · {selected.difficulty || 'Difficulty not set'}</Text></View><View style={styles.detailActions}><TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('CenterDiveSiteDetail', { siteId: selected.id })} style={styles.detailButton}><Text style={styles.detailButtonText}>Open site profile</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => openEdit(selected)} style={styles.editButton}><Text style={styles.editButtonText}>Edit</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => removeSite(selected)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>Remove</Text></TouchableOpacity></View></View> : null}
    </> : <View style={styles.empty}><Text style={styles.emptyTitle}>Choose your operation map</Text><Text style={styles.muted}>Select Panglao to start placing dive zones.</Text></View>}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => { if (!saving) setModal(false); }}><View style={styles.backdrop}><View style={styles.modal}><ScrollView keyboardShouldPersistTaps="handled"><View style={styles.modalHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.modalTitle}>{editing ? 'Edit dive site' : 'Add dive site'}</Text><Text style={styles.modalHint}>The pin stays inside the selected operation map.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close dive site form" disabled={saving} onPress={() => setModal(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View><Text style={styles.label}>Name *</Text><TextInput accessibilityLabel="Dive site name" value={form.name} onChangeText={(value) => setField('name', value)} placeholder="Balicasag Cathedral" style={styles.input} /><Text style={styles.label}>Description</Text><TextInput accessibilityLabel="Dive site description" multiline value={form.description} onChangeText={(value) => setField('description', value)} style={[styles.input, styles.multiline]} placeholder="What makes this zone special?" /><View style={styles.row}><View style={styles.half}><Text style={styles.label}>Latitude</Text><TextInput accessibilityLabel="Dive site latitude" keyboardType="decimal-pad" value={form.latitude} onChangeText={(value) => setField('latitude', value)} style={styles.input} /></View><View style={styles.half}><Text style={styles.label}>Longitude</Text><TextInput accessibilityLabel="Dive site longitude" keyboardType="decimal-pad" value={form.longitude} onChangeText={(value) => setField('longitude', value)} style={styles.input} /></View></View><View style={styles.row}><View style={styles.half}><Text style={styles.label}>Min depth (m)</Text><TextInput accessibilityLabel="Minimum depth" keyboardType="number-pad" value={form.minDepth} onChangeText={(value) => setField('minDepth', value)} style={styles.input} /></View><View style={styles.half}><Text style={styles.label}>Max depth (m)</Text><TextInput accessibilityLabel="Maximum depth" keyboardType="number-pad" value={form.maxDepth} onChangeText={(value) => setField('maxDepth', value)} style={styles.input} /></View></View><Text style={styles.label}>Difficulty</Text><TextInput accessibilityLabel="Dive site difficulty" value={form.difficulty} onChangeText={(value) => setField('difficulty', value)} style={styles.input} placeholder="Beginner, Intermediate..." /><Text style={styles.label}>Currents and conditions</Text><TextInput accessibilityLabel="Current information" multiline value={form.currentInfo} onChangeText={(value) => setField('currentInfo', value)} style={[styles.input, styles.multilineSmall]} placeholder="Typical current, tide or visibility" /><Text style={styles.label}>Highlights (comma separated)</Text><TextInput accessibilityLabel="Dive site highlights" value={form.highlights} onChangeText={(value) => setField('highlights', value)} style={styles.input} placeholder="Wall, swim-through, coral garden" /><Text style={styles.label}>Typical sightings</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose typical sightings" onPress={() => setSpeciesPickerOpen(true)} style={styles.input}><Text style={styles.editButtonText}>Choose marine life · {selectedTypicalSightings.length} selected</Text></TouchableOpacity><View style={styles.selectedSpeciesRow}>{selectedTypicalSightings.map((key) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`Remove ${speciesForKey(key)?.name || key}`} onPress={() => setSelectedTypicalSightings((current) => current.filter((item) => item !== key))} style={styles.selectedSpecies}><Text style={styles.selectedSpeciesText}>{speciesForKey(key)?.name || key} ×</Text></TouchableOpacity>)}</View><Text style={styles.formSection}>First route</Text><TextInput accessibilityLabel="Route name" value={form.routeName} onChangeText={(value) => setField('routeName', value)} style={styles.input} placeholder="Outer reef loop" /><TextInput accessibilityLabel="Route notes" value={form.routeNotes} onChangeText={(value) => setField('routeNotes', value)} style={styles.input} placeholder="Route notes" /><TextInput accessibilityLabel="Route points" value={form.routePoints} onChangeText={(value) => setField('routePoints', value)} style={styles.input} placeholder="latitude, longitude; latitude, longitude" /><Text style={styles.routeHint}>Use semicolon-separated coordinates to record a route, for example: 9.60, 123.78; 9.61, 123.79.</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<TouchableOpacity accessibilityRole="button" disabled={saving} onPress={saveSite} style={styles.saveButton}><Text style={styles.saveButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create dive site'}</Text></TouchableOpacity></ScrollView></View></View></Modal>
    <Modal visible={modal && speciesPickerOpen} transparent animationType="fade" onRequestClose={() => setSpeciesPickerOpen(false)}><View style={styles.backdrop}><View style={styles.speciesModal}><View style={styles.modalHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.modalTitle}>Typical sightings</Text><Text style={styles.modalHint}>Choose species from the Pokedex catalog.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close Pokedex species picker" onPress={() => setSpeciesPickerOpen(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View><TextInput accessibilityLabel="Search Pokedex species" value={sightingQuery} onChangeText={setSightingQuery} style={styles.input} placeholder="Search species or category" /><ScrollView nestedScrollEnabled style={styles.speciesPicker}>{filteredSightings.map((species) => { const selected = selectedTypicalSightings.includes(species.key); return <TouchableOpacity key={species.key} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setSelectedTypicalSightings((current) => selected ? current.filter((key) => key !== species.key) : [...current, species.key])} style={[styles.speciesOption, selected && styles.speciesOptionSelected]}><View style={[styles.speciesCheck, selected && styles.speciesCheckSelected]}><Text style={styles.speciesCheckText}>{selected ? '✓' : ''}</Text></View><View style={styles.speciesOptionCopy}><Text style={styles.speciesOptionName}>{species.name}</Text><Text style={styles.speciesOptionCategory}>{species.category}</Text></View></TouchableOpacity>; })}{!filteredSightings.length ? <Text style={styles.noSpeciesSelected}>No Pokedex species found.</Text> : null}</ScrollView><TouchableOpacity accessibilityRole="button" onPress={() => setSpeciesPickerOpen(false)} style={styles.saveButton}><Text style={styles.saveButtonText}>Done · {selectedTypicalSightings.length} selected</Text></TouchableOpacity></View></View></Modal>
  </ScrollView>;
}

function PanglaoMap({ map, sites, selectedId, placing, onSelect, onMapPress }: { map: OperationMapTemplate; sites: DiveSite[]; selectedId?: number; placing: boolean; onSelect: (site: DiveSite) => void; onMapPress: (point: { x: number; y: number }) => void }) {
  const host = useRef<any>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const callbacks = useRef({ placing, onSelect, onMapPress, sites });
  callbacks.current = { placing, onSelect, onMapPress, sites };
  const width = MAP_WIDTH / camera.zoom;
  const height = MAP_HEIGHT / camera.zoom;
  const constrain = (next: typeof camera) => ({
    ...next,
    x: Math.max(0, Math.min(MAP_WIDTH - MAP_WIDTH / next.zoom, next.x)),
    y: Math.max(0, Math.min(MAP_HEIGHT - MAP_HEIGHT / next.zoom, next.y)),
  });
  const zoomBy = (factor: number, anchor?: { x: number; y: number }) => setCamera((current) => {
    const zoom = Math.max(1, Math.min(6, current.zoom * factor));
    const point = anchor || { x: current.x + MAP_WIDTH / current.zoom / 2, y: current.y + MAP_HEIGHT / current.zoom / 2 };
    return constrain({ zoom, x: point.x - (point.x - current.x) * current.zoom / zoom, y: point.y - (point.y - current.y) * current.zoom / zoom });
  });
  // SVG's inverse screen matrix includes its viewBox, scale and letterboxing.
  // Using offsetX/offsetY here would instead measure from the clicked child.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const svg = host.current?.querySelector('svg') as SVGSVGElement | undefined;
    if (!svg) return;
    const pointAt = (event: { clientX: number; clientY: number }) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      return point.matrixTransform(matrix.inverse());
    };
    let drag: { id: number; x: number; y: number; camera: typeof camera; scale: number; moved: boolean; target: Element | null } | null = null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: cameraRef.current, scale: matrix.a, moved: false, target: event.target as Element };
      svg.setPointerCapture(event.pointerId);
      svg.focus();
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      if (drag.moved) setCamera(constrain({ ...drag.camera, x: drag.camera.x - dx / drag.scale, y: drag.camera.y - dy / drag.scale }));
    };
    const up = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const ended = drag; drag = null;
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      if (ended.moved) return;
      const point = pointAt(event);
      if (!point || point.x < 0 || point.x > MAP_WIDTH || point.y < 0 || point.y > MAP_HEIGHT) return;
      if (callbacks.current.placing) callbacks.current.onMapPress(point);
      else {
        const id = ended.target?.closest('[data-site-id]')?.getAttribute('data-site-id');
        const site = callbacks.current.sites.find((item) => String(item.id) === id);
        if (site) callbacks.current.onSelect(site);
      }
    };
    const cancel = () => { drag = null; };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const point = pointAt(event);
      if (point) zoomBy(event.deltaY < 0 ? 1.25 : 0.8, point);
    };
    const keyboard = (event: KeyboardEvent) => {
      const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (directions[event.key]) {
        event.preventDefault();
        const [dx, dy] = directions[event.key];
        setCamera((current) => constrain({ ...current, x: current.x + dx * 70 / current.zoom, y: current.y + dy * 70 / current.zoom }));
      } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.5); }
      else if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.5); }
      else if (event.key === 'Home') { event.preventDefault(); setCamera({ x: 0, y: 0, zoom: 1 }); }
    };
    svg.setAttribute('tabindex', '0');
    svg.style.touchAction = 'none';
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', cancel);
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('keydown', keyboard);
    return () => {
      svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', cancel);
      svg.removeEventListener('wheel', wheel); svg.removeEventListener('keydown', keyboard);
    };
  }, []);
  const features = useMemo(() => BOHOL_FEATURES.map((feature) => ({ name: feature.name, path: geometryToPath(feature.geometry, map), center: geometryCenter(feature.geometry, map) })), [map]);
  const route = sites.find((site) => site.id === selectedId)?.routes?.[0]?.points || [];
  const routePath = route.map((point, index) => { const p = project(point.latitude, point.longitude, map); return `${index ? 'L' : 'M'}${p.x},${p.y}`; }).join(' ');
  // Keep pins and labels readable as the geographic view zooms.
  const [renderedWidth, setRenderedWidth] = useState(900);
  const unit = Math.max(width / renderedWidth, height / 360);
  return <View ref={host} style={styles.mapCanvas} onLayout={(event) => setRenderedWidth(Math.max(1, event.nativeEvent.layout.width))}>
    <Svg width="100%" height={360} onPress={Platform.OS === 'web' ? undefined : (event: any) => {
      if (!placing) return;
      const scale = Math.min(renderedWidth / width, 360 / height);
      const x = camera.x + (event.nativeEvent.locationX - (renderedWidth - width * scale) / 2) / scale;
      const y = camera.y + (event.nativeEvent.locationY - (360 - height * scale) / 2) / scale;
      if (x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT) onMapPress({ x, y });
    }} viewBox={`${camera.x} ${camera.y} ${width} ${height}`} accessibilityLabel="Operation map. Drag to pan, use plus and minus to zoom, or arrow keys to pan.">
      <Path d="M0 0H900V470H0Z" fill="#dff4f4" />
      {features.map((feature) => <Path key={feature.name} d={feature.path} fill="#b8debf" stroke="#75ad91" strokeWidth={unit} strokeLinejoin="round" />)}
      {features.filter((feature) => ['Panglao', 'Dauis', 'City of Tagbilaran', 'Baclayon'].includes(feature.name)).map((feature) => <SvgText key={feature.name} x={feature.center.x} y={feature.center.y} fill="#2f6e65" fontSize={11 * unit} textAnchor="middle">{feature.name.replace('City of ', '')}</SvgText>)}
      {routePath ? <Path d={routePath} fill="none" stroke="#0b777b" strokeWidth={3 * unit} strokeDasharray={`${6 * unit} ${4 * unit}`} /> : null}
      {sites.map((site) => {
        const point = project(site.latitude, site.longitude, map);
        const active = site.id === selectedId;
        const left = point.x > camera.x + width * 0.68;
        return <G key={site.id} {...({ 'data-site-id': site.id } as any)} onPress={Platform.OS === 'web' ? undefined : () => onSelect(site)}>
          <Circle cx={point.x} cy={point.y} r={18 * unit} fill="#0b777b" opacity={0.16} />
          <Circle cx={point.x} cy={point.y} r={(active ? 8 : 6) * unit} fill={active ? '#123b52' : '#0b777b'} stroke="#fff" strokeWidth={2 * unit} />
          <SvgText x={point.x + (left ? -13 : 13) * unit} y={point.y - 10 * unit} textAnchor={left ? 'end' : 'start'} fill="#123b52" stroke="#fff" strokeWidth={3 * unit} fontFamily="sans-serif" fontSize={12 * unit} fontWeight="bold" {...({ paintOrder: 'stroke' } as any)}>{site.name.length > 28 ? site.name.slice(0, 27) + '…' : site.name}</SvgText>
        </G>;
      })}
    </Svg>
    <View style={styles.zoomControls}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom in" disabled={camera.zoom >= 6} onPress={() => zoomBy(1.5)} style={styles.zoomButton}><Text style={styles.zoomButtonText}>+</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zoom out" disabled={camera.zoom <= 1} onPress={() => zoomBy(1 / 1.5)} style={styles.zoomButton}><Text style={styles.zoomButtonText}>−</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset map zoom" onPress={() => setCamera({ x: 0, y: 0, zoom: 1 })} style={styles.resetZoomButton}><Text style={styles.resetZoomText}>Reset</Text></TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  mapCanvas: { position: 'relative' }, zoomControls: { position: 'absolute', right: 12, top: 12, gap: 7, alignItems: 'center' }, zoomButton: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.94)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#9ebdc2' }, zoomButtonText: { color: '#123b52', fontSize: 24, lineHeight: 26, fontWeight: 'bold' }, resetZoomButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: 'rgba(255,255,255,.94)', borderWidth: 1, borderColor: '#9ebdc2' }, resetZoomText: { color: '#0b777b', fontSize: 10, fontWeight: 'bold' }, speciesModal: { width: '100%', maxWidth: 560, maxHeight: '88%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20 }, speciesPicker: { maxHeight: 360, borderWidth: 1, borderColor: '#dbe8ef', borderRadius: 12, marginTop: 10 }, speciesOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#e8f0f3' }, speciesOptionSelected: { backgroundColor: '#e6faf6' }, speciesCheck: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, borderColor: '#a8bec9', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, speciesCheckSelected: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' }, speciesCheckText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }, speciesOptionCopy: { flex: 1, minWidth: 0 }, speciesOptionName: { color: '#41596b', fontSize: 13, fontWeight: 'bold' }, speciesOptionCategory: { color: '#7890a0', fontSize: 11, marginTop: 3 }, selectedSpeciesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, selectedSpecies: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e4f2ee', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 }, selectedSpeciesText: { color: '#0b777b', fontSize: 12, fontWeight: 'bold' }, selectedSpeciesRemove: { color: '#0b777b', fontSize: 16, lineHeight: 16 }, noSpeciesSelected: { color: '#718394', fontSize: 12, padding: 14 },
  screen: { flex: 1, backgroundColor: '#f3f6f8' }, content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 20, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, muted: { color: '#718394', marginTop: 8 }, error: { color: '#b42318', marginTop: 12 }, hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#e1ebee', borderWidth: 1, borderColor: '#b9cdd3', borderRadius: 22, padding: 24 }, heroCopy: { flexGrow: 1, flexBasis: 260, minWidth: 0 }, eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 }, title: { color: '#123b52', fontSize: 29, fontWeight: 'bold', marginTop: 5 }, subtitle: { color: '#536b7a', lineHeight: 21, marginTop: 7 }, heroBadge: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, heroValue: { color: '#123b52', fontSize: 23, fontWeight: 'bold' }, heroLabel: { color: '#718394', fontSize: 10, marginTop: 2 }, mapChoice: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 17, marginTop: 16 }, sectionCopy: { flex: 1 }, sectionTitle: { color: '#123b52', fontSize: 19, fontWeight: 'bold' }, sectionHint: { color: '#718394', fontSize: 12, marginTop: 4 }, mapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13 }, mapOption: { minWidth: 190, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 13, padding: 12 }, mapOptionActive: { borderColor: '#0b777b', backgroundColor: '#e4f2ee' }, mapOptionTitle: { color: '#123b52', fontWeight: 'bold' }, mapOptionMeta: { color: '#718394', fontSize: 11, marginTop: 3 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 16 }, searchBox: { flex: 1, minWidth: 240 }, searchInput: { minHeight: 46, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 12, paddingHorizontal: 13, color: '#263f4d', backgroundColor: '#fff' }, placeButton: { borderWidth: 1, borderColor: '#0b777b', borderRadius: 21, paddingHorizontal: 14, paddingVertical: 11 }, placeButtonActive: { backgroundColor: '#e4f2ee' }, placeButtonText: { color: '#0b777b', fontWeight: 'bold' }, addButton: { backgroundColor: '#123b52', borderRadius: 21, paddingHorizontal: 15, paddingVertical: 12 }, addButtonText: { color: '#fff', fontWeight: 'bold' }, mapPanel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 17, marginTop: 16 }, mapPanelHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 12 }, attribution: { color: '#718394', fontSize: 10 }, mapFrame: { overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: '#b9d9d9', backgroundColor: '#dff4f4' }, resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }, siteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }, siteCard: { flexGrow: 1, flexShrink: 1, flexBasis: 330, maxWidth: '100%', minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 15, padding: 15 }, siteCardActive: { borderColor: '#0b777b', backgroundColor: '#f4fbfa' }, siteCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, siteName: { flex: 1, color: '#123b52', fontSize: 17, fontWeight: 'bold' }, difficulty: { color: '#0b777b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }, siteDescription: { color: '#607789', fontSize: 12, lineHeight: 18, marginTop: 9 }, siteMeta: { color: '#718394', fontSize: 11, marginTop: 11 }, empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 28, alignItems: 'center', marginTop: 16 }, emptyTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold' }, detailPanel: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, backgroundColor: '#e4f2ee', borderWidth: 1, borderColor: '#9bc9c1', borderRadius: 17, padding: 17, marginTop: 16 }, detailCopy: { flexGrow: 1, flexBasis: 240, minWidth: 0 }, detailTitle: { color: '#123b52', fontSize: 23, fontWeight: 'bold', marginTop: 4 }, detailDescription: { color: '#536b7a', lineHeight: 19, marginTop: 6 }, detailMeta: { color: '#0b777b', fontSize: 11, marginTop: 8 }, detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailButton: { backgroundColor: '#123b52', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 }, detailButtonText: { color: '#fff', fontWeight: 'bold' }, editButton: { borderWidth: 1, borderColor: '#0b777b', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }, editButtonText: { color: '#0b777b', fontWeight: 'bold' }, deleteButton: { borderWidth: 1, borderColor: '#e6bcbc', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 }, deleteButtonText: { color: '#b42318', fontWeight: 'bold' }, backdrop: { flex: 1, backgroundColor: 'rgba(8,34,48,.48)', justifyContent: 'center', padding: 18 }, modal: { width: '100%', maxWidth: 680, maxHeight: '93%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20 }, modalHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }, modalTitle: { color: '#123b52', fontSize: 22, fontWeight: 'bold' }, modalHint: { color: '#718394', fontSize: 12, marginTop: 4 }, close: { color: '#6e8794', fontSize: 27 }, label: { color: '#123b52', fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 5 }, input: { minHeight: 44, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', backgroundColor: '#fff' }, multiline: { minHeight: 80, textAlignVertical: 'top' }, multilineSmall: { minHeight: 66, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1, minWidth: 0 }, formSection: { color: '#123b52', fontSize: 15, fontWeight: 'bold', marginTop: 20, marginBottom: 2 }, routeHint: { color: '#718394', fontSize: 11, lineHeight: 16, marginTop: 6 }, saveButton: { backgroundColor: '#123b52', borderRadius: 21, padding: 13, alignItems: 'center', marginTop: 19 }, saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
