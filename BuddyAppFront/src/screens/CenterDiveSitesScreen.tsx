import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
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

const emptyForm = {
  name: '',
  description: '',
  latitude: '9.60',
  longitude: '123.78',
  minDepth: '',
  maxDepth: '',
  difficulty: 'Intermediate',
  currentInfo: '',
  highlights: '',
  routeName: '',
  routeNotes: '',
  routePoints: '',
};
type Form = typeof emptyForm;

const project = (latitude: number, longitude: number, map: OperationMapTemplate) => ({
  x: ((longitude - map.bounds.west) / (map.bounds.east - map.bounds.west)) * MAP_WIDTH,
  y: ((map.bounds.north - latitude) / (map.bounds.north - map.bounds.south)) * MAP_HEIGHT,
});

const ringToPath = (ring: number[][], map: OperationMapTemplate) =>
  ring
    .map(([longitude, latitude], index) => {
      const point = project(latitude, longitude, map);
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(' ') + ' Z';

const geometryToPath = (geometry: GeoGeometry, map: OperationMapTemplate) => {
  if (geometry.type === 'Polygon') return geometry.coordinates.map((ring: number[][]) => ringToPath(ring, map)).join(' ');
  return geometry.coordinates.flatMap((polygon: number[][][]) => polygon.map((ring) => ringToPath(ring, map))).join(' ');
};

const geometryCenter = (geometry: GeoGeometry, map: OperationMapTemplate) => {
  const points: number[][] = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0]?.[0] || [];
  if (!points.length) return { x: 0, y: 0 };
  const totals = points.reduce(
    (sum, point) => ({ longitude: sum.longitude + point[0], latitude: sum.latitude + point[1] }),
    { longitude: 0, latitude: 0 },
  );
  return project(totals.latitude / points.length, totals.longitude / points.length, map);
};

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parsePoints = (value: string) =>
  value
    .split(';')
    .map((pair) => {
      const [latitude, longitude, ...label] = pair.split(',').map((part) => part.trim());
      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        ...(label.length ? { label: label.join(', ') } : {}),
      };
    })
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

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
    setLoading(true);
    setError('');
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
      } catch {
        setSpeciesCatalog([]);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not load the operation map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visibleSites = useMemo(() => {
    const value = query.trim().toLowerCase();
    return sites.filter(
      (site) =>
        !value ||
        `${site.name} ${site.description || ''} ${site.difficulty || ''} ${(site.typicalSightings || [])
          .map((key) => speciesCatalog.find((species) => species.key === key)?.name || key)
          .join(' ')}`
          .toLowerCase()
          .includes(value),
    );
  }, [query, sites, speciesCatalog]);

  const filteredSightings = useMemo(() => {
    const value = sightingQuery.trim().toLocaleLowerCase();
    return speciesCatalog.filter(
      (species) => !value || `${species.name} ${species.category}`.toLocaleLowerCase().includes(value),
    );
  }, [sightingQuery, speciesCatalog]);

  const speciesForKey = useCallback(
    (key: string) => speciesCatalog.find((species) => species.key === key),
    [speciesCatalog],
  );

  const normalizeSightings = useCallback(
    (values: string[]) =>
      values
        .map((value) => speciesCatalog.find((species) => species.key === value || species.name === value)?.key)
        .filter((value): value is string => Boolean(value)),
    [speciesCatalog],
  );

  const setField = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseMap = async (mapKey: string) => {
    setSaving(true);
    setError('');
    try {
      const response = await API.patch('/center/operation-map', { mapKey });
      setMap(response.data.map || null);
      setSelectedMapKey(response.data.selectedMapKey || mapKey);
      setSites(response.data.sites || []);
      setSelected(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not select this operation map.');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = (coordinates?: { latitude: number; longitude: number }) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      ...(coordinates
        ? { latitude: coordinates.latitude.toFixed(5), longitude: coordinates.longitude.toFixed(5) }
        : {}),
    });
    setSelectedTypicalSightings([]);
    setSightingQuery('');
    setSpeciesPickerOpen(false);
    setError('');
    setModal(true);
    setPlacing(false);
  };

  const openEdit = (site: DiveSite) => {
    const route = site.routes?.[0];
    setEditing(site);
    setSelectedTypicalSightings(normalizeSightings(site.typicalSightings || []));
    setSightingQuery('');
    setSpeciesPickerOpen(false);
    setForm({
      ...emptyForm,
      name: site.name,
      description: site.description || '',
      latitude: String(site.latitude),
      longitude: String(site.longitude),
      minDepth: site.minDepth == null ? '' : String(site.minDepth),
      maxDepth: site.maxDepth == null ? '' : String(site.maxDepth),
      difficulty: site.difficulty || 'Intermediate',
      currentInfo: site.currentInfo || '',
      highlights: (site.highlights || []).join(', '),
      routeName: route?.name || '',
      routeNotes: route?.notes || '',
      routePoints:
        route?.points?.map((point) => [point.latitude, point.longitude, point.label].filter(Boolean).join(', ')).join('; ') || '',
    });
    setError('');
    setModal(true);
  };

  const saveSite = async () => {
    if (!form.name.trim() || !map) {
      setError('Choose a map and enter a dive site name.');
      return;
    }
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Enter valid coordinates for the pin.');
      return;
    }
    setSaving(true);
    setError('');
    const routes = form.routeName.trim()
      ? [{ name: form.routeName.trim(), notes: form.routeNotes.trim() || undefined, points: parsePoints(form.routePoints) }]
      : [];
    const payload = {
      mapKey: map.key,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      latitude,
      longitude,
      minDepth: form.minDepth ? Number(form.minDepth) : undefined,
      maxDepth: form.maxDepth ? Number(form.maxDepth) : undefined,
      difficulty: form.difficulty.trim() || undefined,
      currentInfo: form.currentInfo.trim() || undefined,
      highlights: parseList(form.highlights),
      typicalSightings: normalizeSightings(selectedTypicalSightings),
      routes,
    };
    try {
      const response = editing
        ? await API.patch(`/center/dive-sites/${editing.id}`, payload)
        : await API.post('/center/dive-sites', payload);
      const next = response.data as DiveSite;
      setSites((current) =>
        editing ? current.map((site) => (site.id === next.id ? next : site)) : [...current, next].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelected(next);
      setModal(false);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Could not save this dive site.');
    } finally {
      setSaving(false);
    }
  };

  const removeSite = async (site: DiveSite) => {
    setSaving(true);
    setError('');
    try {
      await API.delete(`/center/dive-sites/${site.id}`);
      setSites((current) => current.filter((candidate) => candidate.id !== site.id));
      setSelected(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not remove this dive site.');
    } finally {
      setSaving(false);
    }
  };

  const handleMapCoordSelect = (latitude: number, longitude: number) => {
    openCreate({ latitude, longitude });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#123b52" />
        <Text style={styles.muted}>Loading operation map…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>CENTER OPERATIONS</Text>
          <Text style={styles.title}>Dive sites map</Text>
          <Text style={styles.subtitle}>Build a local guide for your center and share the best routes with divers.</Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroValue}>{sites.length}</Text>
          <Text style={styles.heroLabel}>sites mapped</Text>
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <View style={styles.mapChoice}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Operation area</Text>
          <Text style={styles.sectionHint}>Choose the coastal map where your center operates. More regions can be added later.</Text>
        </View>
        <View style={styles.mapOptions}>
          {catalog.map((candidate) => (
            <TouchableOpacity
              key={candidate.key}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedMapKey === candidate.key }}
              onPress={() => chooseMap(candidate.key)}
              style={[styles.mapOption, selectedMapKey === candidate.key && styles.mapOptionActive]}
            >
              <Text style={styles.mapOptionTitle}>{candidate.name}</Text>
              <Text style={styles.mapOptionMeta}>{candidate.country}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {map ? (
        <>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <TextInput
                accessibilityLabel="Search dive sites"
                placeholder="Search dive sites, wildlife or difficulty"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.placeButton, placing && styles.placeButtonActive]}
              onPress={() => setPlacing((current) => !current)}
            >
              <Text style={[styles.placeButtonText, placing && styles.placeButtonTextActive]}>
                {placing ? 'Click map to place…' : '+ Place pin'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.addButton} onPress={() => openCreate()}>
              <Text style={styles.addButtonText}>Add details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapPanel}>
            <View style={styles.mapPanelHeader}>
              <View>
                <Text style={styles.sectionTitle}>{map.name}</Text>
                <Text style={styles.sectionHint}>
                  {placing ? 'Click anywhere inside the map to set a new pin.' : 'Select a pin to open its dive site profile. Drag to explore.'}
                </Text>
              </View>
              <Text style={styles.attribution}>{map.attribution}</Text>
            </View>
            <View style={styles.mapFrame}>
              <PanglaoMap
                map={map}
                sites={visibleSites}
                selectedId={selected?.id}
                placing={placing}
                onSelect={(site) => {
                  setSelected(site);
                  setPlacing(false);
                }}
                onCoordSelect={handleMapCoordSelect}
              />
            </View>
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.sectionTitle}>Dive zones</Text>
            <Text style={styles.sectionHint}>
              {visibleSites.length} of {sites.length} shown
            </Text>
          </View>

          <View style={styles.siteGrid}>
            {visibleSites.map((site) => (
              <TouchableOpacity
                key={site.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selected?.id === site.id }}
                style={[styles.siteCard, selected?.id === site.id && styles.siteCardActive]}
                onPress={() => setSelected(site)}
              >
                <View style={styles.siteCardTop}>
                  <Text style={styles.siteName}>{site.name}</Text>
                  <Text style={styles.difficulty}>{site.difficulty || 'Unrated'}</Text>
                </View>
                <Text numberOfLines={2} style={styles.siteDescription}>
                  {site.description || 'No description yet.'}
                </Text>
                <Text style={styles.siteMeta}>
                  {site.minDepth ?? '?'}–{site.maxDepth ?? '?'} m · {(site.typicalSightings || []).length} typical sightings ·{' '}
                  {(site.routes || []).length} route{(site.routes || []).length === 1 ? '' : 's'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!visibleSites.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No dive zones match</Text>
              <Text style={styles.muted}>Try another search or place your first pin.</Text>
            </View>
          ) : null}

          {selected ? (
            <View style={styles.detailPanel}>
              <View style={styles.detailCopy}>
                <Text style={styles.eyebrow}>SELECTED DIVE ZONE</Text>
                <Text style={styles.detailTitle}>{selected.name}</Text>
                <Text style={styles.detailDescription}>
                  {selected.description || 'Add a description so visiting divers know what to expect.'}
                </Text>
                <Text style={styles.detailMeta}>
                  {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)} · {selected.difficulty || 'Difficulty not set'}
                </Text>
              </View>
              <View style={styles.detailActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('CenterDiveSiteDetail', { siteId: selected.id })}
                  style={styles.detailButton}
                >
                  <Text style={styles.detailButtonText}>Open site profile</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => openEdit(selected)} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => removeSite(selected)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Choose your operation map</Text>
          <Text style={styles.muted}>Select Panglao to start placing dive zones.</Text>
        </View>
      )}

      {/* Main Dive Site Form Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{editing ? 'Edit dive site' : 'Add dive site'}</Text>
                  <Text style={styles.modalHint}>The pin stays inside the selected operation map.</Text>
                </View>
                <TouchableOpacity accessibilityLabel="Close dive site form" onPress={() => setModal(false)}>
                  <Text style={styles.close}>×</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Name *</Text>
              <TextInput
                accessibilityLabel="Dive site name"
                value={form.name}
                onChangeText={(value) => setField('name', value)}
                placeholder="Balicasag Cathedral"
                style={styles.input}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                accessibilityLabel="Dive site description"
                multiline
                value={form.description}
                onChangeText={(value) => setField('description', value)}
                style={[styles.input, styles.multiline]}
                placeholder="What makes this zone special?"
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput
                    accessibilityLabel="Dive site latitude"
                    keyboardType="decimal-pad"
                    value={form.latitude}
                    onChangeText={(value) => setField('latitude', value)}
                    style={styles.input}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    accessibilityLabel="Dive site longitude"
                    keyboardType="decimal-pad"
                    value={form.longitude}
                    onChangeText={(value) => setField('longitude', value)}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Min depth (m)</Text>
                  <TextInput
                    accessibilityLabel="Minimum depth"
                    keyboardType="number-pad"
                    value={form.minDepth}
                    onChangeText={(value) => setField('minDepth', value)}
                    style={styles.input}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Max depth (m)</Text>
                  <TextInput
                    accessibilityLabel="Maximum depth"
                    keyboardType="number-pad"
                    value={form.maxDepth}
                    onChangeText={(value) => setField('maxDepth', value)}
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.label}>Difficulty</Text>
              <TextInput
                accessibilityLabel="Dive site difficulty"
                value={form.difficulty}
                onChangeText={(value) => setField('difficulty', value)}
                style={styles.input}
                placeholder="Beginner, Intermediate..."
              />

              <Text style={styles.label}>Currents and conditions</Text>
              <TextInput
                accessibilityLabel="Current information"
                multiline
                value={form.currentInfo}
                onChangeText={(value) => setField('currentInfo', value)}
                style={[styles.input, styles.multilineSmall]}
                placeholder="Typical current, tide or visibility"
              />

              <Text style={styles.label}>Highlights (comma separated)</Text>
              <TextInput
                accessibilityLabel="Dive site highlights"
                value={form.highlights}
                onChangeText={(value) => setField('highlights', value)}
                style={styles.input}
                placeholder="Wall, swim-through, coral garden"
              />

              <View style={styles.sightingHeaderRow}>
                <Text style={styles.label}>Typical sightings</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setSpeciesPickerOpen(true)}
                  style={styles.selectSpeciesButton}
                >
                  <Text style={styles.selectSpeciesButtonText}>+ Select from catalog</Text>
                </TouchableOpacity>
              </View>

              {selectedTypicalSightings.length > 0 ? (
                <View style={styles.selectedSpeciesRow}>
                  {selectedTypicalSightings.map((key) => {
                    const species = speciesForKey(key);
                    return (
                      <View key={key} style={styles.selectedSpecies}>
                        <Text style={styles.selectedSpeciesText}>{species?.name || key}</Text>
                        <TouchableOpacity
                          accessibilityLabel={`Remove ${species?.name || key}`}
                          onPress={() =>
                            setSelectedTypicalSightings((current) => current.filter((cand) => cand !== key))
                          }
                          style={styles.removeTagTouch}
                        >
                          <Text style={styles.selectedSpeciesRemove}>×</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setSpeciesPickerOpen(true)}
                  style={styles.sightingsPlaceholder}
                >
                  <Text style={styles.sightingsPlaceholderText}>
                    Click here to choose sightings from the catalog (0 selected)
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={styles.formSection}>First route</Text>
              <TextInput
                accessibilityLabel="Route name"
                value={form.routeName}
                onChangeText={(value) => setField('routeName', value)}
                style={styles.input}
                placeholder="Outer reef loop"
              />
              <TextInput
                accessibilityLabel="Route notes"
                value={form.routeNotes}
                onChangeText={(value) => setField('routeNotes', value)}
                style={styles.input}
                placeholder="Route notes"
              />
              <TextInput
                accessibilityLabel="Route points"
                value={form.routePoints}
                onChangeText={(value) => setField('routePoints', value)}
                style={styles.input}
                placeholder="latitude, longitude; latitude, longitude"
              />
              <Text style={styles.routeHint}>
                Use semicolon-separated coordinates to record a route, for example: 9.60, 123.78; 9.61, 123.79.
              </Text>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

              <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={saveSite} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create dive site'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Marine Life / Typical Sightings Picker Modal */}
      <Modal visible={modal && speciesPickerOpen} transparent animationType="fade" onRequestClose={() => setSpeciesPickerOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.speciesModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Typical sightings</Text>
                <Text style={styles.modalHint}>Choose species from the Pokedex catalog.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close Pokedex species picker" onPress={() => setSpeciesPickerOpen(false)}>
                <Text style={styles.close}>×</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              accessibilityLabel="Search Pokedex species"
              value={sightingQuery}
              onChangeText={setSightingQuery}
              style={styles.input}
              placeholder="Search species or category"
            />

            <ScrollView nestedScrollEnabled style={styles.speciesPicker}>
              {filteredSightings.map((species) => {
                const isSelected = selectedTypicalSightings.includes(species.key);
                return (
                  <TouchableOpacity
                    key={species.key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() =>
                      setSelectedTypicalSightings((current) =>
                        isSelected ? current.filter((key) => key !== species.key) : [...current, species.key],
                      )
                    }
                    style={[styles.speciesOption, isSelected && styles.speciesOptionSelected]}
                  >
                    <View style={[styles.speciesCheck, isSelected && styles.speciesCheckSelected]}>
                      <Text style={styles.speciesCheckText}>{isSelected ? '✓' : ''}</Text>
                    </View>
                    <View style={styles.speciesOptionCopy}>
                      <Text style={styles.speciesOptionName}>{species.name}</Text>
                      <Text style={styles.speciesOptionCategory}>{species.category}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {!filteredSightings.length ? (
                <Text style={styles.noSpeciesSelected}>No Pokedex species found.</Text>
              ) : null}
            </ScrollView>

            {selectedTypicalSightings.length > 0 ? (
              <View style={styles.selectedSpeciesRow}>
                {selectedTypicalSightings.map((key) => {
                  const species = speciesForKey(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${species?.name || key}`}
                      onPress={() =>
                        setSelectedTypicalSightings((current) => current.filter((candidate) => candidate !== key))
                      }
                      style={styles.selectedSpecies}
                    >
                      <Text style={styles.selectedSpeciesText}>{species?.name || key}</Text>
                      <Text style={styles.selectedSpeciesRemove}>×</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setSpeciesPickerOpen(false)}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Done · {selectedTypicalSightings.length} selected</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function PanglaoMap({
  map,
  sites,
  selectedId,
  placing,
  onSelect,
  onCoordSelect,
}: {
  map: OperationMapTemplate;
  sites: DiveSite[];
  selectedId?: number;
  placing: boolean;
  onSelect: (site: DiveSite) => void;
  onCoordSelect: (latitude: number, longitude: number) => void;
}) {
  const [camera, setCamera] = useState({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 });
  const [renderedSize, setRenderedSize] = useState({ width: MAP_WIDTH, height: 420 });
  const containerRef = useRef<View>(null);
  const dragged = useRef(false);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const renderedSizeRef = useRef(renderedSize);
  renderedSizeRef.current = renderedSize;
  const placingRef = useRef(placing);
  placingRef.current = placing;

  const viewBoxWidth = MAP_WIDTH / camera.zoom;
  const viewBoxHeight = MAP_HEIGHT / camera.zoom;
  const halfW = viewBoxWidth / 2;
  const halfH = viewBoxHeight / 2;
  const viewBoxX = camera.x - halfW;
  const viewBoxY = camera.y - halfH;

  const moveCamera = useCallback((dx: number, dy: number, factor = 1) => {
    setCamera((current) => {
      const zoom = Math.max(1, Math.min(6, Number((current.zoom * factor).toFixed(2))));
      const nextHalfW = MAP_WIDTH / zoom / 2;
      const nextHalfH = MAP_HEIGHT / zoom / 2;
      return {
        zoom,
        x: Math.max(nextHalfW, Math.min(MAP_WIDTH - nextHalfW, current.x + dx)),
        y: Math.max(nextHalfH, Math.min(MAP_HEIGHT - nextHalfH, current.y + dy)),
      };
    });
  }, []);

  const resetView = useCallback(() => {
    setCamera({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 1 });
  }, []);

  const transformClientToSvg = useCallback(
    (clientX: number, clientY: number, containerElement: HTMLElement) => {
      const svg = containerElement.querySelector('svg');
      if (svg && typeof (svg as any).getScreenCTM === 'function') {
        try {
          const ctm = (svg as any).getScreenCTM();
          if (ctm) {
            const pt = (svg as any).createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const svgP = pt.matrixTransform(ctm.inverse());
            if (Number.isFinite(svgP.x) && Number.isFinite(svgP.y)) {
              return {
                x: Math.max(0, Math.min(MAP_WIDTH, svgP.x)),
                y: Math.max(0, Math.min(MAP_HEIGHT, svgP.y)),
              };
            }
          }
        } catch {
          // Fall back to geometric calculation below
        }
      }

      // Mathematical fallback accounting for letterbox / pillarbox (meet)
      const rect = containerElement.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const elemW = rect.width;
      const elemH = rect.height;
      const currCamera = cameraRef.current;
      const currVbW = MAP_WIDTH / currCamera.zoom;
      const currVbH = MAP_HEIGHT / currCamera.zoom;
      const currVbX = currCamera.x - currVbW / 2;
      const currVbY = currCamera.y - currVbH / 2;

      const vbAspect = currVbW / currVbH;
      const elemAspect = elemW / elemH;
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (elemAspect > vbAspect) {
        scale = elemH / currVbH;
        offsetX = (elemW - currVbW * scale) / 2;
      } else {
        scale = elemW / currVbW;
        offsetY = (elemH - currVbH * scale) / 2;
      }

      const svgX = currVbX + (clickX - offsetX) / scale;
      const svgY = currVbY + (clickY - offsetY) / scale;
      return {
        x: Math.max(0, Math.min(MAP_WIDTH, svgX)),
        y: Math.max(0, Math.min(MAP_HEIGHT, svgY)),
      };
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = containerRef.current as unknown as HTMLElement;
    if (!element) return;

    let start: { x: number; y: number; id: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragged.current = false;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      dragged.current = true;
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Ignored if capture unsupported
      }

      const rect = element.getBoundingClientRect();
      const elemW = rect.width || MAP_WIDTH;
      const elemH = rect.height || 420;
      const currCamera = cameraRef.current;
      const scale = Math.min(elemW / MAP_WIDTH, elemH / MAP_HEIGHT) * currCamera.zoom;

      moveCamera(-dx / Math.max(0.1, scale), -dy / Math.max(0.1, scale));
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!start) return;
      const wasDragged = dragged.current;
      start = null;
      if (!wasDragged && placingRef.current) {
        const svgCoords = transformClientToSvg(event.clientX, event.clientY, element);
        const latitude = map.bounds.north - (svgCoords.y / MAP_HEIGHT) * (map.bounds.north - map.bounds.south);
        const longitude = map.bounds.west + (svgCoords.x / MAP_WIDTH) * (map.bounds.east - map.bounds.west);
        onCoordSelect(latitude, longitude);
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      moveCamera(0, 0, event.deltaY < 0 ? 1.2 : 0.82);
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('wheel', onWheel);
    };
  }, [map, moveCamera, onCoordSelect, transformClientToSvg]);

  const selectedSite = sites.find((site) => site.id === selectedId);
  const selectedRoute = selectedSite?.routes?.[0]?.points || [];
  const routePath = selectedRoute
    .map((point, index) => {
      const projected = project(point.latitude, point.longitude, map);
      return `${index === 0 ? 'M' : 'L'}${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
    })
    .join(' ');

  const markerScale = Math.max(0.65, 1 / Math.sqrt(camera.zoom));

  return (
    <View
      ref={containerRef}
      style={[styles.mapCanvas, placing && styles.mapCanvasPlacing]}
      onLayout={(event: any) => {
        const width = Number(event?.nativeEvent?.layout?.width);
        const height = Number(event?.nativeEvent?.layout?.height);
        if (width && height) setRenderedSize({ width, height });
      }}
    >
      <Svg
        width="100%"
        height={420}
        viewBox={`${viewBoxX.toFixed(2)} ${viewBoxY.toFixed(2)} ${viewBoxWidth.toFixed(2)} ${viewBoxHeight.toFixed(2)}`}
        preserveAspectRatio="xMidYMid meet"
        accessibilityLabel="Panglao and Bohol operation map"
      >
        {/* Ocean Background */}
        <Path d="M0 0H900V470H0Z" fill="#d8eff2" />

        {/* Bohol Island Landmasses */}
        {BOHOL_FEATURES.map((feature) => (
          <Path
            key={feature.name}
            d={geometryToPath(feature.geometry, map)}
            fill="#b8debf"
            stroke="#75ad91"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}

        {/* Municipality Labels */}
        {BOHOL_FEATURES.filter((feature) =>
          ['Panglao', 'Dauis', 'City of Tagbilaran', 'Baclayon'].includes(feature.name),
        ).map((feature) => {
          const center = geometryCenter(feature.geometry, map);
          const label = feature.name === 'City of Tagbilaran' ? 'Tagbilaran' : feature.name;
          return (
            <SvgText
              key={`label-${feature.name}`}
              x={center.x}
              y={center.y}
              fill="#255951"
              fontSize={12 * markerScale}
              fontWeight="bold"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

        {/* Active Site Route preview */}
        {routePath ? (
          <Path
            d={routePath}
            fill="none"
            stroke="#d46830"
            strokeWidth={4 * markerScale}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${8 * markerScale} ${6 * markerScale}`}
          />
        ) : null}

        <SvgText
          x="610"
          y="438"
          fill="#34747a"
          fontSize={15 * markerScale}
          fontWeight="bold"
          textAnchor="middle"
          opacity={0.8}
        >
          Bohol Sea
        </SvgText>

        {/* Dive Site Pins with Pill badges for high readability */}
        {sites.map((site) => {
          const point = project(site.latitude, site.longitude, map);
          const active = selectedId === site.id;
          const outerRadius = (active ? 16 : 12) * markerScale;
          const innerRadius = (active ? 8 : 6) * markerScale;
          const textLength = site.name.length;
          const badgeWidth = Math.max(50, textLength * 7.5 + 16) * markerScale;
          const badgeHeight = 20 * markerScale;
          const badgeX = point.x + outerRadius + 4 * markerScale;
          const badgeY = point.y - badgeHeight / 2;

          return (
            <G
              key={site.id}
              onPress={() => {
                if (!dragged.current) onSelect(site);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer halo */}
              <Circle
                cx={point.x}
                cy={point.y}
                r={outerRadius}
                fill={active ? '#123b52' : '#0b777b'}
                opacity={active ? 0.35 : 0.22}
              />
              {/* Inner pin */}
              <Circle
                cx={point.x}
                cy={point.y}
                r={innerRadius}
                fill={active ? '#123b52' : '#0b777b'}
                stroke="#fff"
                strokeWidth={2.5 * markerScale}
              />
              {/* Text Label Badge */}
              <Rect
                x={badgeX}
                y={badgeY}
                width={badgeWidth}
                height={badgeHeight}
                rx={10 * markerScale}
                fill={active ? '#123b52' : '#ffffff'}
                stroke={active ? '#0b777b' : '#94b7be'}
                strokeWidth={1 * markerScale}
                opacity={active ? 0.96 : 0.92}
              />
              <SvgText
                x={badgeX + badgeWidth / 2}
                y={point.y + 4 * markerScale}
                fill={active ? '#ffffff' : '#123b52'}
                fontSize={11 * markerScale}
                fontWeight="bold"
                textAnchor="middle"
              >
                {site.name}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Placing Indicator Bar */}
      {placing ? (
        <View pointerEvents="none" style={styles.placingBanner}>
          <Text style={styles.placingBannerText}>📍 Click anywhere on the map to set a new dive site pin</Text>
        </View>
      ) : null}

      {/* Map Interactive Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          accessibilityLabel="Zoom in"
          accessibilityRole="button"
          onPress={() => moveCamera(0, 0, 1.4)}
          style={styles.zoomButton}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Zoom out"
          accessibilityRole="button"
          onPress={() => moveCamera(0, 0, 0.71)}
          style={styles.zoomButton}
        >
          <Text style={styles.zoomButtonText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Reset map view"
          accessibilityRole="button"
          onPress={resetView}
          style={styles.resetZoomButton}
        >
          <Text style={styles.resetZoomText}>Reset</Text>
        </TouchableOpacity>
        <View style={styles.zoomIndicator}>
          <Text style={styles.zoomIndicatorText}>{Math.round(camera.zoom * 100)}%</Text>
        </View>
      </View>

      {/* Helpful Hint on bottom right */}
      <View pointerEvents="none" style={styles.mapHintBadge}>
        <Text style={styles.mapHintText}>Drag to pan · Ctrl + scroll to zoom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f8' },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#718394', marginTop: 8 },
  error: { color: '#b42318', marginTop: 12 },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: '#e1ebee',
    borderWidth: 1,
    borderColor: '#b9cdd3',
    borderRadius: 22,
    padding: 24,
  },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#123b52', fontSize: 29, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#536b7a', lineHeight: 21, marginTop: 7 },
  heroBadge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: { color: '#123b52', fontSize: 23, fontWeight: 'bold' },
  heroLabel: { color: '#718394', fontSize: 10, marginTop: 2 },
  mapChoice: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 17,
    marginTop: 16,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: '#123b52', fontSize: 19, fontWeight: 'bold' },
  sectionHint: { color: '#718394', fontSize: 12, marginTop: 4 },
  mapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13 },
  mapOption: { minWidth: 190, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 13, padding: 12 },
  mapOptionActive: { borderColor: '#0b777b', backgroundColor: '#e4f2ee' },
  mapOptionTitle: { color: '#123b52', fontWeight: 'bold' },
  mapOptionMeta: { color: '#718394', fontSize: 11, marginTop: 3 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },
  searchBox: { flex: 1, minWidth: 240 },
  searchInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 12,
    paddingHorizontal: 13,
    color: '#263f4d',
    backgroundColor: '#fff',
  },
  placeButton: {
    borderWidth: 1.5,
    borderColor: '#0b777b',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  placeButtonActive: { backgroundColor: '#0b777b' },
  placeButtonText: { color: '#0b777b', fontWeight: 'bold', fontSize: 13 },
  placeButtonTextActive: { color: '#fff' },
  addButton: {
    backgroundColor: '#123b52',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  mapPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 17,
    marginTop: 16,
  },
  mapPanelHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  attribution: { color: '#718394', fontSize: 10 },
  mapFrame: {
    overflow: 'hidden',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#b9d9d9',
    backgroundColor: '#d8eff2',
  },
  mapCanvas: {
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none' } as any) : {}),
  },
  mapCanvasPlacing: {
    ...(Platform.OS === 'web' ? ({ cursor: 'crosshair' } as any) : {}),
  },
  placingBanner: {
    position: 'absolute',
    top: 12,
    left: 14,
    backgroundColor: 'rgba(18, 59, 82, 0.92)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  placingBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 7,
    alignItems: 'center',
    zIndex: 10,
  },
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9ebdc2',
    shadowColor: '#123b52',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  zoomButtonText: { color: '#123b52', fontSize: 24, lineHeight: 26, fontWeight: 'bold' },
  resetZoomButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,.94)',
    borderWidth: 1,
    borderColor: '#9ebdc2',
    shadowColor: '#123b52',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  resetZoomText: { color: '#0b777b', fontSize: 10, fontWeight: 'bold' },
  zoomIndicator: {
    backgroundColor: 'rgba(255,255,255,.94)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9ebdc2',
  },
  zoomIndicatorText: { color: '#536b7a', fontSize: 9, fontWeight: 'bold' },
  mapHintBadge: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    backgroundColor: 'rgba(255,255,255,.88)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#b4cfd4',
  },
  mapHintText: { color: '#536b7a', fontSize: 10, fontWeight: '600' },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 4,
  },
  siteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  siteCard: {
    flexGrow: 1,
    flexBasis: 330,
    minWidth: 280,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 15,
    padding: 15,
  },
  siteCardActive: { borderColor: '#0b777b', backgroundColor: '#f4fbfa' },
  siteCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  siteName: { flex: 1, color: '#123b52', fontSize: 17, fontWeight: 'bold' },
  difficulty: { color: '#0b777b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  siteDescription: { color: '#607789', fontSize: 12, lineHeight: 18, marginTop: 9 },
  siteMeta: { color: '#718394', fontSize: 11, marginTop: 11 },
  empty: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 28,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold' },
  detailPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: '#e4f2ee',
    borderWidth: 1,
    borderColor: '#9bc9c1',
    borderRadius: 17,
    padding: 17,
    marginTop: 16,
  },
  detailCopy: { flex: 1, minWidth: 240 },
  detailTitle: { color: '#123b52', fontSize: 23, fontWeight: 'bold', marginTop: 4 },
  detailDescription: { color: '#536b7a', lineHeight: 19, marginTop: 6 },
  detailMeta: { color: '#0b777b', fontSize: 11, marginTop: 8 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailButton: { backgroundColor: '#123b52', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  detailButtonText: { color: '#fff', fontWeight: 'bold' },
  editButton: { borderWidth: 1, borderColor: '#0b777b', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff' },
  editButtonText: { color: '#0b777b', fontWeight: 'bold' },
  deleteButton: { borderWidth: 1, borderColor: '#e6bcbc', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#fff' },
  deleteButtonText: { color: '#b42318', fontWeight: 'bold' },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,34,48,.48)', justifyContent: 'center', padding: 18 },
  modal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '93%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  modalTitle: { color: '#123b52', fontSize: 22, fontWeight: 'bold' },
  modalHint: { color: '#718394', fontSize: 12, marginTop: 4 },
  close: { color: '#6e8794', fontSize: 27 },
  label: { color: '#123b52', fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 5 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#334155',
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  multilineSmall: { minHeight: 66, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  sightingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 5,
  },
  selectSpeciesButton: {
    borderWidth: 1,
    borderColor: '#0b777b',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#e4f2ee',
  },
  selectSpeciesButtonText: { color: '#0b777b', fontSize: 11, fontWeight: 'bold' },
  sightingsPlaceholder: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#fbfcfd',
  },
  sightingsPlaceholderText: { color: '#718394', fontSize: 12 },
  formSection: { color: '#123b52', fontSize: 15, fontWeight: 'bold', marginTop: 20, marginBottom: 2 },
  routeHint: { color: '#718394', fontSize: 11, lineHeight: 16, marginTop: 6 },
  saveButton: { backgroundColor: '#123b52', borderRadius: 21, padding: 13, alignItems: 'center', marginTop: 19 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  speciesModal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  speciesPicker: { maxHeight: 340, borderWidth: 1, borderColor: '#dbe8ef', borderRadius: 12, marginTop: 10 },
  speciesOption: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f0f3',
  },
  speciesOptionSelected: { backgroundColor: '#e6faf6' },
  speciesCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#a8bec9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  speciesCheckSelected: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  speciesCheckText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  speciesOptionCopy: { flex: 1, minWidth: 0 },
  speciesOptionName: { color: '#41596b', fontSize: 13, fontWeight: 'bold' },
  speciesOptionCategory: { color: '#7890a0', fontSize: 11, marginTop: 3 },
  selectedSpeciesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  selectedSpecies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e4f2ee',
    borderWidth: 1,
    borderColor: '#b9deda',
    borderRadius: 15,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
  },
  selectedSpeciesText: { color: '#0b777b', fontSize: 12, fontWeight: 'bold' },
  removeTagTouch: { padding: 2 },
  selectedSpeciesRemove: { color: '#0b777b', fontSize: 16, lineHeight: 16, fontWeight: 'bold' },
  noSpeciesSelected: { color: '#718394', fontSize: 12, padding: 14, textAlign: 'center' },
});
