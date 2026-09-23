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
  country: string;
  dives: Dive[];
  left: number;
  top: number;
};

type Coordinate = { latitude: number; longitude: number };

const COUNTRY_COORDINATES: Record<string, Coordinate> = {
  spain: { latitude: 39.5, longitude: -8.3 },
  portugal: { latitude: 39.5, longitude: -8.0 },
  andorra: { latitude: 42.5, longitude: 1.5 },
  afghanistan: { latitude: 34.2, longitude: 61.8 },
  albania: { latitude: 41.2, longitude: 20.2 },
  france: { latitude: 46.2, longitude: 2.2 },
  italy: { latitude: 42.8, longitude: 12.8 },
  germany: { latitude: 51.2, longitude: 10.4 },
  unitedkingdom: { latitude: 55.4, longitude: -3.4 },
  norway: { latitude: 64.5, longitude: 11.0 },
  greece: { latitude: 39.1, longitude: 22.9 },
  turkey: { latitude: 39.0, longitude: 35.2 },
  morocco: { latitude: 31.8, longitude: -7.1 },
  egypt: { latitude: 26.8, longitude: 30.8 },
  southafrica: { latitude: -30.6, longitude: 22.9 },
  nigeria: { latitude: 9.1, longitude: 8.7 },
  unitedstates: { latitude: 38.0, longitude: -97.0 },
  canada: { latitude: 56.1, longitude: -106.3 },
  mexico: { latitude: 23.6, longitude: -102.5 },
  brazil: { latitude: -10.8, longitude: -52.9 },
  argentina: { latitude: -34.0, longitude: -64.0 },
  colombia: { latitude: 4.6, longitude: -74.1 },
  australia: { latitude: -25.3, longitude: 133.8 },
  newzealand: { latitude: -41.0, longitude: 174.0 },
  japan: { latitude: 36.2, longitude: 138.3 },
  china: { latitude: 35.9, longitude: 104.2 },
  india: { latitude: 22.9, longitude: 79.9 },
  pakistan: { latitude: 30.4, longitude: 69.3 },
  thailand: { latitude: 15.9, longitude: 100.9 },
  indonesia: { latitude: -2.5, longitude: 118.0 },
  philippines: { latitude: 13.5, longitude: 117.0 },
  russia: { latitude: 61.5, longitude: 105.3 },
  peru: { latitude: -9.2, longitude: -75.0 },
  chile: { latitude: -33.4, longitude: -70.7 },
  ecuador: { latitude: -1.8, longitude: -78.2 },
  vietnam: { latitude: 14.1, longitude: 108.3 },
  malaysia: { latitude: 4.2, longitude: 101.9 },
  singapore: { latitude: 1.35, longitude: 103.8 },
  seychelles: { latitude: -4.7, longitude: 55.5 },
  maldives: { latitude: 3.2, longitude: 73.2 },
  madagascar: { latitude: -18.8, longitude: 46.9 },
  mauritius: { latitude: -20.3, longitude: 57.6 },
  fiji: { latitude: -17.7, longitude: 178.1 },
  palau: { latitude: 7.5, longitude: 134.6 },
  papuanewguinea: { latitude: -6.3, longitude: 147.0 },
};

const COUNTRY_ALIASES: Record<string, string> = {
  espana: 'spain', francia: 'france', italia: 'italy', alemania: 'germany',
  reinounido: 'unitedkingdom', afganistan: 'afghanistan', grecia: 'greece',
  turquia: 'turkey', marruecos: 'morocco', egipto: 'egypt', sudafrica: 'southafrica',
  estadosunidosdeamerica: 'unitedstates', brasil: 'brazil', argentina: 'argentina',
  colombia: 'colombia', australia: 'australia', nuevazelanda: 'newzealand',
  japon: 'japan', india: 'india', pakistan: 'pakistan', tailandia: 'thailand',
  indonesia: 'indonesia', filipinas: 'philippines', rusia: 'russia', peru: 'peru',
  chile: 'chile', ecuador: 'ecuador', vietnam: 'vietnam', malasia: 'malaysia',
  singapur: 'singapore', seychelles: 'seychelles', maldivas: 'maldives',
  madagascar: 'madagascar', mauricio: 'mauritius', fiyi: 'fiji', papuanuevaguinea: 'papuanewguinea',
};

const countryKey = (value: string) =>
  value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

const pointForCountry = (country: string) => {
  const key = countryKey(country);
  const coordinate = COUNTRY_COORDINATES[COUNTRY_ALIASES[key] || key];
  if (!coordinate) return null;
  return {
    left: ((coordinate.longitude + 180) / 360) * 100,
    top: ((90 - coordinate.latitude) / 180) * 100,
  };
};

const WORLD_MAP_URI = 'https://upload.wikimedia.org/wikipedia/commons/9/9f/BlankMap-World-Equirectangular.svg';

export default function DiveMapScreen({ navigation }: any) {
  const [dives, setDives] = useState<Dive[]>([]);
  const [query, setQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
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

  const groupedDives = filteredDives.reduce<Record<string, Dive[]>>((groups, dive) => {
    groups[dive.country] = [...(groups[dive.country] || []), dive];
    return groups;
  }, {});
  const unplacedCountries = Object.keys(groupedDives).filter((country) => !pointForCountry(country));
  const markers: Marker[] = Object.entries(groupedDives).flatMap(([country, countryDives]) => {
    const point = pointForCountry(country);
    return point ? [{ country, dives: countryDives, left: point.left, top: point.top }] : [];
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
              source={{ uri: WORLD_MAP_URI }}
              style={styles.worldMapImage}
              resizeMode="stretch"
              accessibilityLabel="Public domain world map"
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
              <Text style={styles.legendItem}>● Countries visited</Text>
              <Text style={styles.legendItem}>Number = dives</Text>
            </View>

            {markers.map((marker) => (
              <TouchableOpacity
                key={marker.country}
                accessibilityRole="button"
                accessibilityLabel={`Open dives in ${marker.country}`}
                style={[styles.marker, { left: `calc(${marker.left}% - 17px)`, top: `calc(${marker.top}% - 17px)` } as any, marker.country === selectedMarker?.country && styles.selectedMarker]}
                onPress={() => setSelectedMarker(marker)}
              >
                <Text style={styles.markerText}>{marker.dives.length}</Text>
              </TouchableOpacity>
            ))}

            {selectedMarker && (
              <View style={[styles.popup, Platform.OS === 'web' && styles.webPopup]}>
                <Text style={styles.popupTitle}>{selectedMarker.country}</Text>
                <Text style={styles.popupText}>{selectedMarker.dives.length} logged dive{selectedMarker.dives.length === 1 ? '' : 's'}</Text>
                {selectedMarker.dives.slice(0, 2).map((dive) => (
                  <Text key={dive.id} style={styles.popupDive} numberOfLines={1}>{dive.location}</Text>
                ))}
                <TouchableOpacity onPress={() => navigation.navigate('DiveDetail', { diveId: selectedMarker.dives[0].id })}>
                  <Text style={styles.popupLink}>View latest dive</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      <Text style={styles.mapCredit}>Base map: Wikimedia Commons, CC0 / public domain</Text>
      {unplacedCountries.length > 0 && (
        <Text style={styles.unplacedText}>No map position for: {unplacedCountries.join(', ')}</Text>
      )}

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
  mapViewport: { width: '100%', aspectRatio: 1.97, borderRadius: 20, backgroundColor: '#d7edf5' },
  webMapViewport: { overflow: 'hidden' },
  mapCanvas: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 20, backgroundColor: '#c7e7ee' },
  webMapCanvas: { width: '100%' },
  worldMapImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  zoomControls: { position: 'absolute', left: 14, top: 14, zIndex: 5, gap: 6 },
  zoomButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#0077CC', fontSize: 24, fontWeight: 'bold' },
  legend: { position: 'absolute', top: 14, right: 14, zIndex: 5, backgroundColor: 'white', padding: 12, borderRadius: 12, width: 150 },
  legendTitle: { color: '#0077CC', fontWeight: 'bold', marginBottom: 5 },
  legendItem: { color: '#555', fontSize: 12, marginTop: 3 },
  marker: { position: 'absolute', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0077CC', borderWidth: 3, borderColor: 'white', zIndex: 3 },
  selectedMarker: { backgroundColor: '#00A8A8', transform: [{ scale: 1.25 }] },
  markerText: { color: 'white', fontSize: 13, lineHeight: 16, fontWeight: 'bold' },
  popup: { position: 'absolute', left: '50%', bottom: 16, transform: [{ translateX: -120 }], width: 240, padding: 14, borderRadius: 14, backgroundColor: 'white', zIndex: 8 },
  webPopup: { bottom: -18 },
  popupTitle: { color: '#0077CC', fontSize: 16, fontWeight: 'bold' },
  popupText: { color: '#555', marginTop: 4 },
  popupDive: { color: '#4f6474', fontSize: 12, marginTop: 6 },
  popupLink: { color: '#00A8A8', fontWeight: 'bold', marginTop: 10 },
  mapCredit: { color: '#738494', fontSize: 11, marginTop: 7, textAlign: 'right' },
  unplacedText: { color: '#8b5e34', fontSize: 12, marginTop: 8, textAlign: 'right' },
  loader: { flex: 1 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 24 },
});
