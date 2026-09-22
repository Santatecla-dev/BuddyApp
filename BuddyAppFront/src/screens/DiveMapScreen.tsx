import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import API from '../api/api';
import { Dive } from '../types';

type Marker = {
  dive: Dive;
  left: number;
  top: number;
};

const COUNTRY_POINTS: Record<string, { left: number; top: number }> = {
  spain: { left: 47, top: 34 },
  espana: { left: 47, top: 34 },
  portugal: { left: 45, top: 36 },
  andorra: { left: 49, top: 32 },
  afghanistan: { left: 65, top: 39 },
  afganistan: { left: 65, top: 39 },
  albania: { left: 54, top: 36 },
  france: { left: 48, top: 30 },
  francia: { left: 48, top: 30 },
  italy: { left: 52, top: 37 },
  italia: { left: 52, top: 37 },
  germany: { left: 52, top: 29 },
  alemania: { left: 52, top: 29 },
  unitedkingdom: { left: 47, top: 25 },
  reinounido: { left: 47, top: 25 },
  norway: { left: 51, top: 17 },
  greece: { left: 56, top: 39 },
  turkey: { left: 59, top: 36 },
  morocco: { left: 45, top: 43 },
  egypt: { left: 56, top: 47 },
  southafrica: { left: 53, top: 75 },
  nigeria: { left: 46, top: 53 },
  unitedstates: { left: 24, top: 34 },
  estadosunidosdeamerica: { left: 24, top: 34 },
  canada: { left: 25, top: 22 },
  mexico: { left: 25, top: 47 },
  brazil: { left: 34, top: 62 },
  argentina: { left: 31, top: 77 },
  colombia: { left: 28, top: 55 },
  australia: { left: 79, top: 72 },
  newzealand: { left: 89, top: 78 },
  japan: { left: 84, top: 37 },
  china: { left: 72, top: 37 },
  india: { left: 65, top: 48 },
  thailand: { left: 70, top: 53 },
  indonesia: { left: 72, top: 63 },
  philippines: { left: 77, top: 54 },
};

const countryKey = (value: string) =>
  value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

const WORLD_MAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 480">
<g fill="none" stroke="#ffffff" stroke-width="1" opacity=".2">
<path d="M0 120H900M0 240H900M0 360H900M180 0V480M360 0V480M540 0V480M720 0V480"/>
</g>
<g fill="#a8d0a8" stroke="#689b78" stroke-width="2" stroke-linejoin="round">
<path d="M48 108C68 84 96 72 128 67C162 60 195 67 224 80C249 91 270 108 294 117L279 143C260 153 244 161 228 174L205 169L184 182L158 198L126 187L102 168L74 155L54 133Z"/>
<path d="M202 54C220 39 247 30 269 36L280 55L263 69L238 67Z"/>
<path d="M301 238C322 225 350 230 367 249L382 277L371 315L355 352L345 395L324 433L304 410L298 376L283 340L278 302L290 272Z"/>
<path d="M414 112L432 92L466 82L497 89L516 105L540 108L553 123L537 139L510 139L494 153L468 148L444 156L421 148Z"/>
<path d="M531 83C562 70 606 62 647 67L695 65L744 79L779 101L811 136L837 178L804 192L778 207L770 247L736 232L701 220L675 232L650 212L621 211L601 194L571 178L547 157L526 143L552 122L563 104Z"/>
<path d="M451 171L482 161L515 171L545 198L559 238L543 277L527 314L506 352L482 390L455 365L438 329L427 292L414 254L420 218Z"/>
<path d="M678 349L710 334L750 340L786 359L813 380L789 401L752 414L713 411L683 397L665 375Z"/>
<path d="M824 218L838 210L851 218L847 231L833 237L822 230Z"/>
<path d="M785 270L798 264L808 273L801 284L787 283Z"/>
</g>
<g fill="#8fbd96" opacity=".75" font-family="Arial, sans-serif" font-size="12" font-weight="600" text-anchor="middle">
<text x="170" y="132">North America</text><text x="329" y="316">South America</text><text x="467" y="126">Europe</text><text x="485" y="267">Africa</text><text x="682" y="143">Asia</text><text x="741" y="380">Oceania</text>
</g></svg>`;

export default function DiveMapScreen({ navigation }: any) {
  const [dives, setDives] = useState<Dive[]>([]);
  const [query, setQuery] = useState('');
  const [selectedDive, setSelectedDive] = useState<Dive | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/dives/my')
      .then((response) => setDives(response.data))
      .catch(() => setDives([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredDives = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return dives;
    return dives.filter((dive) =>
      `${dive.location} ${dive.country}`.toLocaleLowerCase().includes(value)
    );
  }, [dives, query]);

  const markers: Marker[] = filteredDives.map((dive, index) => {
    const point = COUNTRY_POINTS[countryKey(dive.country)] || {
      left: 20 + ((index * 29) % 65),
      top: 25 + ((index * 37) % 50),
    };
    return {
      dive,
      left: point.left + (index % 3 - 1) * 1.4,
      top: point.top + (index % 2 ? 1.2 : -1.2),
    };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Dive sites</Text>
          <Text style={styles.subtitle}>Explore the places in your logbook</Text>
        </View>
        <Text style={styles.resultCount}>{filteredDives.length} sites</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by site or country"
        accessibilityLabel="Search dive sites"
        style={styles.searchInput}
      />

      <View style={[styles.filterRow, Platform.OS === 'web' && styles.webFilterRow]}>
        <TouchableOpacity style={styles.filterActive} onPress={() => setQuery('')}>
          <Text style={styles.filterActiveText}>All sites</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setQuery('Spain')}>
          <Text style={styles.filterText}>Spain</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setQuery('Portugal')}>
          <Text style={styles.filterText}>Portugal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setQuery('Mexico')}>
          <Text style={styles.filterText}>Mexico</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.mapViewport, Platform.OS === 'web' && styles.webMapViewport]}>
        {loading ? (
          <ActivityIndicator color="#0077CC" style={styles.loader} />
        ) : (
          <View style={[styles.mapCanvas, Platform.OS === 'web' && styles.webMapCanvas, { transform: [{ scale: zoom }] }]}>
            <Image
              source={{ uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(WORLD_MAP_SVG)}` }}
              style={styles.worldMapImage}
              resizeMode="stretch"
              accessibilityLabel="Stylized world map"
            />
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomButton} onPress={() => setZoom((value) => Math.min(2, value + 0.25))}>
                <Text style={styles.zoomText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={() => setZoom((value) => Math.max(0.75, value - 0.25))}>
                <Text style={styles.zoomText}>−</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Legend</Text>
              <Text style={styles.legendItem}>● My dive sites</Text>
              <Text style={styles.legendItem}>○ Shared sites</Text>
            </View>

            {markers.map((marker) => (
              <TouchableOpacity
                key={marker.dive.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${marker.dive.location}`}
                style={[styles.marker, { left: `${marker.left}%`, top: `${marker.top}%` }, marker.dive.id === selectedDive?.id && styles.selectedMarker]}
                onPress={() => setSelectedDive(marker.dive)}
              >
                <Text style={styles.markerText}>●</Text>
              </TouchableOpacity>
            ))}

            {selectedDive && (
              <View style={[styles.popup, Platform.OS === 'web' && styles.webPopup]}>
                <Text style={styles.popupTitle}>{selectedDive.location}</Text>
                <Text style={styles.popupText}>{selectedDive.country}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('DiveDetail', { diveId: selectedDive.id })}>
                  <Text style={styles.popupLink}>View dive details</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {!loading && filteredDives.length === 0 && (
        <Text style={styles.emptyText}>No dive sites match your search.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  headingCopy: { flex: 1 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#555', marginTop: 4, fontSize: 15 },
  resultCount: { color: '#00A8A8', fontWeight: 'bold', marginBottom: 4 },
  searchInput: { backgroundColor: 'white', borderColor: '#0077CC', borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, color: '#222' },
  filterRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  webFilterRow: { flexWrap: 'nowrap', width: 760 },
  filterActive: { backgroundColor: '#0077CC', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  filterActiveText: { color: 'white', fontWeight: 'bold' },
  filterButton: { backgroundColor: 'white', borderColor: '#b8d8ee', borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  filterText: { color: '#0077CC', fontWeight: 'bold' },
  mapViewport: { height: 480, width: '100%', borderRadius: 20, backgroundColor: '#d7edf5' },
  webMapViewport: { overflow: 'hidden' },
  mapCanvas: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 20, backgroundColor: '#c7e7ee' },
  webMapCanvas: { width: 900 },
  worldMapImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  zoomControls: { position: 'absolute', left: 14, top: 14, zIndex: 5, gap: 6 },
  zoomButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#0077CC', fontSize: 24, fontWeight: 'bold' },
  legend: { position: 'absolute', top: 14, right: 14, zIndex: 5, backgroundColor: 'white', padding: 12, borderRadius: 12, width: 150 },
  legendTitle: { color: '#0077CC', fontWeight: 'bold', marginBottom: 5 },
  legendItem: { color: '#555', fontSize: 12, marginTop: 3 },
  marker: { position: 'absolute', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0077CC', borderWidth: 3, borderColor: 'white', zIndex: 3 },
  selectedMarker: { backgroundColor: '#00A8A8', transform: [{ scale: 1.25 }] },
  markerText: { color: 'white', fontSize: 20, lineHeight: 20 },
  popup: { position: 'absolute', left: '50%', bottom: 16, transform: [{ translateX: -120 }], width: 240, padding: 14, borderRadius: 14, backgroundColor: 'white', zIndex: 8 },
  webPopup: { bottom: -18 },
  popupTitle: { color: '#0077CC', fontSize: 16, fontWeight: 'bold' },
  popupText: { color: '#555', marginTop: 4 },
  popupLink: { color: '#00A8A8', fontWeight: 'bold', marginTop: 10 },
  loader: { flex: 1 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 24 },
});
