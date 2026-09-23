import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import API from '../api/api';
import { Dive, PokedexCategory, PokedexSpecies } from '../types';

const CATEGORIES: Array<'All' | PokedexCategory> = ['All', 'Sharks', 'Tropical fish', 'Macro', 'Crustaceans', 'Rays', 'Pelagic'];

export default function PokedexScreen() {
  const { width } = useWindowDimensions();
  const narrowLayout = width < 620;
  const [species, setSpecies] = useState<PokedexSpecies[]>([]);
  const [dives, setDives] = useState<Dive[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | PokedexCategory>('All');
  const [selectedSpecies, setSelectedSpecies] = useState<PokedexSpecies | null>(null);
  const [selectedDiveIds, setSelectedDiveIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDives, setLoadingDives] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPokedex = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/pokedex');
      setSpecies(response.data);
    } catch {
      setError('Could not load the Pokedex.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPokedex(); }, []);

  const filteredSpecies = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const searchTerm = normalized.split('').reverse().join('');
    return species.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      const matchesQuery = !normalized || item.name.toLocaleLowerCase().includes(searchTerm);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, species]);

  const filterActive = category !== 'All' || query.trim().length > 0;

  const categoryStats = useMemo(() => CATEGORIES.slice(1).map((name) => ({
    name,
    count: filteredSpecies.filter((item) => item.category === name).length,
  })), [filteredSpecies]);

  const openSightingsModal = async (item: PokedexSpecies) => {
    setSelectedSpecies(item);
    setSelectedDiveIds([]);
    if (dives.length) return;
    setLoadingDives(true);
    try {
      const response = await API.get('/dives/my');
      setDives(response.data);
    } catch {
      setDives([]);
    } finally {
      setLoadingDives(false);
    }
  };

  const toggleDive = (diveId: number) => {
    setSelectedDiveIds((current) => current.includes(diveId)
      ? current.filter((id) => id !== diveId)
      : [...current, diveId]);
  };

  const saveSighting = async () => {
    if (!selectedSpecies || !selectedDiveIds.length) return;
    setSaving(true);
    try {
      await API.post('/pokedex/sightings', {
        speciesKey: selectedSpecies.key,
        diveIds: selectedDiveIds,
      });
      setSelectedSpecies(null);
      await loadPokedex();
    } catch {
      setError('Could not save this sighting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MARINE LIFE ALBUM</Text>
            <Text style={styles.title}>Pokedex</Text>
            <Text style={styles.subtitle}>Keep track of the creatures you have found underwater.</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{species.filter((item) => (item.sightingsCount || 0) > 0).length}</Text>
            <Text style={styles.headerStatLabel}>discovered</Text>
          </View>
        </View>

        <TextInput
          accessibilityLabel="Search species"
          placeholder="Search creatures"
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, query.length > 0 && styles.searchInputGhostText]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((option) => (
            <TouchableOpacity
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: category === option }}
              onPress={() => setCategory(option)}
              style={[styles.categoryButton, category === option && styles.categoryButtonActive]}
            >
              <Text style={[styles.categoryText, category === option && styles.categoryTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && (
          <View style={[styles.albumGrid, narrowLayout && styles.narrowAlbumGrid]}>
            {filteredSpecies.map((item) => {
              const count = item.sightingsCount || 0;
              return (
                <TouchableOpacity
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name} sighting`}
                  onPress={() => openSightingsModal(item)}
                  style={[styles.albumCard, styles.albumCardShadow, filterActive && styles.filteredAlbumCard]}
                >
                  <View style={styles.imageFrame}>
                    <Image source={{ uri: item.imageUrl }} style={styles.speciesImage} resizeMode="cover" />
                    <View style={[styles.countBadge, count === 0 && styles.newBadge]}>
                      <Text style={styles.countText}>{count === 0 ? 'NEW' : count}</Text>
                    </View>
                  </View>
                  <Text style={styles.speciesName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.speciesCategory}>{item.category}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {!loading && !error && filteredSpecies.length === 0 ? <Text style={styles.emptyText}>No creatures match your search.</Text> : null}
        {!loading && !error ? (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Species statistics</Text>
            <Text style={styles.statsSubtitle}>Creatures in the current view</Text>
            <View style={styles.chartViewport}>
              {categoryStats.map((stat) => (
                <View key={stat.name} style={styles.chartColumn}>
                  <View style={[styles.chartBar, { height: `${Math.max(18, (stat.count / Math.max(species.length, 1)) * 100)}%` }]}>
                    <Text style={styles.chartValue}>{stat.count}</Text>
                  </View>
                  <Text style={styles.chartLabel} numberOfLines={1}>{stat.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(selectedSpecies)} animationType="slide" transparent onRequestClose={() => setSelectedSpecies(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, narrowLayout && styles.narrowModalCard]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleCopy}>
                <Text style={styles.modalEyebrow}>ADD SIGHTING</Text>
                <Text style={styles.modalTitle}>{selectedSpecies?.name}</Text>
                <Text style={styles.modalSubtitle}>Link this species to one or more dives.</Text>
              </View>
              <Pressable accessibilityLabel="Close" onPress={() => setSelectedSpecies(null)} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            {loadingDives ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : null}
            {!loadingDives && !dives.length ? <Text style={styles.emptyText}>Create a dive before adding a sighting.</Text> : null}
            {!loadingDives && dives.length ? (
              <ScrollView style={styles.divePicker} contentContainerStyle={styles.divePickerContent}>
                {dives.map((dive) => {
                  const checked = selectedDiveIds.includes(dive.id);
                  return (
                    <TouchableOpacity
                      key={dive.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      onPress={() => toggleDive(dive.id)}
                      style={[styles.diveOption, checked && styles.diveOptionSelected]}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxSelected]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View>
                      <View style={styles.diveOptionCopy}>
                        <Text style={styles.diveOptionLocation}>{dive.location}</Text>
                        <Text style={styles.diveOptionMeta}>{dive.country} · {new Date(dive.date).toLocaleDateString()}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={saving || !selectedDiveIds.length}
              accessibilityState={{ disabled: saving || !selectedDiveIds.length, busy: saving }}
              onPress={saveSighting}
              style={[styles.saveButton, (!selectedDiveIds.length || saving) && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : `Add to ${selectedDiveIds.length || 0} dives`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f7fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 22, marginBottom: 18 },
  headerCopy: { flex: 1, paddingRight: 20 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#526b7b', fontSize: 14, marginTop: 5 },
  headerStat: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#00A8A8' },
  headerStatValue: { color: '#0077CC', fontSize: 25, fontWeight: 'bold' },
  headerStatLabel: { color: '#647c8b', fontSize: 11 },
  searchInput: { minHeight: 48, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 24, paddingHorizontal: 16, color: '#1e293b', fontSize: 15 },
  searchInputGhostText: { color: 'transparent', textShadowColor: 'transparent' },
  categoryRow: { gap: 8, paddingVertical: 16 },
  categoryButton: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 20, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 9 },
  categoryButtonActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  categoryText: { color: '#0077CC', fontWeight: 'bold', fontSize: 13 },
  categoryTextActive: { color: '#fff' },
  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  narrowAlbumGrid: { flexWrap: 'nowrap', width: 780, paddingRight: 28 },
  albumCard: { width: 178, backgroundColor: '#fff', borderRadius: 17, padding: 9, borderWidth: 1, borderColor: '#dce8ef', overflow: 'hidden' },
  albumCardShadow: { shadowColor: '#0077CC', shadowOffset: { width: 9, height: 9 }, shadowOpacity: 0.4, shadowRadius: 0, elevation: 9 },
  filteredAlbumCard: { width: 196, height: 196, marginLeft: -12, marginRight: -4, overflow: 'hidden', transform: [{ translateY: 7 }] },
  imageFrame: { width: '100%', height: 148, borderRadius: 12, overflow: 'hidden', backgroundColor: '#dcebf1', position: 'relative' },
  speciesImage: { width: '100%', height: '100%' },
  countBadge: { position: 'absolute', right: 8, top: 8, minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#0077CC', borderWidth: 2, borderColor: '#fff' },
  newBadge: { backgroundColor: '#00A8A8' },
  countText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  speciesName: { color: '#1e293b', fontWeight: 'bold', fontSize: 14, marginTop: 9, minHeight: 36 },
  speciesCategory: { color: '#728396', fontSize: 11, marginTop: 3 },
  statsCard: { marginTop: 28, minWidth: 620, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#dce8ef', shadowColor: '#00A8A8', shadowOffset: { width: -8, height: 8 }, shadowOpacity: 0.26, shadowRadius: 1, elevation: 5 },
  statsTitle: { color: '#0077CC', fontSize: 18, fontWeight: 'bold' },
  statsSubtitle: { color: '#728396', fontSize: 12, marginTop: 3, marginBottom: 12 },
  chartViewport: { height: 168, flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 8, paddingTop: 12, overflow: 'hidden' },
  chartColumn: { width: 72, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: 34, minHeight: 8, borderRadius: 7, backgroundColor: '#00A8A8', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  chartValue: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  chartLabel: { width: 44, color: '#526b7b', fontSize: 9, marginTop: 6, textAlign: 'center' },
  loader: { paddingVertical: 24 },
  errorText: { color: '#b42318', textAlign: 'center', padding: 20 },
  emptyText: { color: '#6b7c8d', textAlign: 'center', padding: 26 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '88%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 20 },
  narrowModalCard: { minWidth: 410, alignSelf: 'flex-start', marginLeft: -52 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  modalTitleCopy: { flex: 1, paddingRight: 12 },
  modalEyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  modalTitle: { color: '#0077CC', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  modalSubtitle: { color: '#667b89', fontSize: 13, marginTop: 4 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eef5f8', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0077CC', fontSize: 27, lineHeight: 29 },
  divePicker: { maxHeight: 390 },
  divePickerContent: { gap: 9, paddingVertical: 6 },
  diveOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce8ef', borderRadius: 14, padding: 12, backgroundColor: '#f9fcfd' },
  diveOptionSelected: { borderColor: '#00A8A8', backgroundColor: '#e9faf7', transform: [{ translateX: 15 }, { translateY: -6 }], marginBottom: -4, zIndex: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  checkboxSelected: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontWeight: 'bold' },
  diveOptionCopy: { flex: 1 },
  diveOptionLocation: { color: '#1e293b', fontWeight: 'bold' },
  diveOptionMeta: { color: '#728396', fontSize: 12, marginTop: 3 },
  saveButton: { minHeight: 48, borderRadius: 25, backgroundColor: '#0077CC', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
