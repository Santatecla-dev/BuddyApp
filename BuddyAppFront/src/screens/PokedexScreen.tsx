import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { diveDate } from '../utils/diveStats';

const CATEGORIES: Array<'All' | PokedexCategory> = ['All', 'Sharks', 'Tropical fish', 'Macro', 'Crustaceans', 'Rays', 'Pelagic'];

export default function PokedexScreen() {
  const { width, fontScale } = useWindowDimensions();
  const narrowLayout = width / fontScale < 480;
  const [gridWidth, setGridWidth] = useState(0);
  const columns = Math.max(1, Math.floor((gridWidth + 14) / (160 * fontScale + 14)));
  const cardWidth = gridWidth ? (gridWidth - (columns - 1) * 14) / columns : 160;
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
  const [modalError, setModalError] = useState('');
  const [sightingKeys, setSightingKeys] = useState<Record<number, string[]>>({});
  const [diveAttempt, setDiveAttempt] = useState(0);
  const submitting = useRef(false);

  const loadPokedex = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/pokedex', { signal });
      if (!signal?.aborted) setSpecies(response.data);
    } catch {
      if (!signal?.aborted) setError('Could not load the Pokedex.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    loadPokedex(controller.signal);
    return () => controller.abort();
  }, []));

  const filteredSpecies = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return species.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      const matchesQuery = !normalized || item.name.toLocaleLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, species]);

  const categoryStats = useMemo(() => CATEGORIES.slice(1).map((name) => ({
    name,
    count: filteredSpecies.filter((item) => item.category === name).length,
  })), [filteredSpecies]);

  const maxCategoryCount = Math.max(1, ...categoryStats.map(stat => stat.count));

  const openSightingsModal = (item: PokedexSpecies) => {
    setSelectedSpecies(item);
    setSelectedDiveIds([]);
    setLoadingDives(true);
    setModalError('');
  };

  useEffect(() => {
    if (!selectedSpecies) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoadingDives(true);
    setModalError('');
    setSelectedDiveIds([]);
    setDives([]);
    setSightingKeys({});
    const load = async () => {
      try {
        const { data } = await API.get<Dive[]>('/dives/my', { signal });
        const keys: Record<number, string[]> = {};
        // Bound concurrent requests: the existing API exposes sightings per dive.
        for (let start = 0; start < data.length; start += 4) {
          const results = await Promise.allSettled(data.slice(start, start + 4).map(async dive => {
            const response = await API.get<PokedexSpecies[]>(`/dives/${dive.id}/sightings`, { signal });
            keys[dive.id] = response.data.map(item => item.key);
          }));
          if (signal.aborted) return;
          if (results.some(result => result.status === 'rejected')) {
            setModalError('Some sightings could not be checked. Those dives are unavailable. Please retry.');
          }
        }
        if (!signal.aborted) { setDives(data); setSightingKeys(keys); }
      } catch {
        if (!signal.aborted) setModalError('Could not load your dives. Please retry.');
      } finally {
        if (!signal.aborted) setLoadingDives(false);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedSpecies, diveAttempt]);

  const closeModal = () => { if (!submitting.current) setSelectedSpecies(null); };

  const toggleDive = (diveId: number) => {
    if (submitting.current || !selectedSpecies || !sightingKeys[diveId] || sightingKeys[diveId].includes(selectedSpecies.key)) return;
    setSelectedDiveIds((current) => current.includes(diveId)
      ? current.filter((id) => id !== diveId)
      : [...current, diveId]);
  };

  const saveSighting = async () => {
    if (submitting.current || !selectedSpecies || !selectedDiveIds.length) return;
    submitting.current = true;
    setSaving(true);
    setModalError('');
    try {
      await API.post('/pokedex/sightings', {
        speciesKey: selectedSpecies.key,
        diveIds: selectedDiveIds,
      });
      setSelectedSpecies(null);
      await loadPokedex();
    } catch {
      setModalError('Could not save this sighting. Please try again.');
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.headerRow, narrowLayout && styles.narrowHeaderRow]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MARINE LIFE ALBUM</Text>
            <Text accessibilityRole="header" style={styles.title}>Pokedex</Text>
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
          style={styles.searchInput}
        />
        <View style={styles.categoryRow}>
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
        </View>

        {loading ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        {error ? <TouchableOpacity accessibilityRole="button" onPress={() => loadPokedex()} style={styles.categoryButton}><Text style={styles.categoryText}>Retry loading album</Text></TouchableOpacity> : null}
        {!loading && !error && (
          <View style={styles.albumGrid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
            {filteredSpecies.map((item) => {
              const count = item.sightingsCount || 0;
              return (
                <TouchableOpacity
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name} sighting, ${count} recorded`}
                  onPress={() => openSightingsModal(item)}
                  style={[styles.albumCard, styles.albumCardShadow, { width: cardWidth }]}
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
            <Text accessibilityRole="header" style={styles.statsTitle}>Species statistics</Text>
            <Text style={styles.statsSubtitle}>Creatures in the current view</Text>
            <View style={styles.chartViewport}>
              {categoryStats.map((stat) => (
                <View key={stat.name} style={styles.chartColumn} accessible accessibilityLabel={`${stat.name}: ${stat.count} species`}>
                  <View style={styles.chartHeading}>
                    <Text style={styles.chartLabel}>{stat.name}</Text>
                    <Text style={styles.chartValue}>{stat.count}</Text>
                  </View>
                  <View style={styles.chartTrack}><View style={[styles.chartBar, { width: `${stat.count / maxCategoryCount * 100}%` }]} /></View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(selectedSpecies)} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleCopy}>
                  <Text style={styles.modalEyebrow}>ADD SIGHTING</Text>
                  <Text style={styles.modalTitle}>{selectedSpecies?.name}</Text>
                  <Text style={styles.modalSubtitle}>Link this species to one or more dives.</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={saving} accessibilityState={{ disabled: saving }} onPress={closeModal} style={styles.closeButton}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              {loadingDives ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : null}
              {modalError ? <Text accessibilityRole="alert" style={styles.errorText}>{modalError}</Text> : null}
              {modalError && !saving ? <TouchableOpacity accessibilityRole="button" onPress={() => setDiveAttempt(value => value + 1)} style={styles.categoryButton}><Text style={styles.categoryText}>Reload dives</Text></TouchableOpacity> : null}
              {!loadingDives && !modalError && !dives.length ? <Text style={styles.emptyText}>Create a dive before adding a sighting.</Text> : null}
              {!loadingDives && dives.length ? (
                <View style={styles.divePickerContent}>
                  {dives.map((dive) => {
                    const checked = selectedDiveIds.includes(dive.id);
                    const known = Boolean(sightingKeys[dive.id]);
                    const recorded = Boolean(selectedSpecies && sightingKeys[dive.id]?.includes(selectedSpecies.key));
                    const disabled = saving || !known || recorded;
                    return (
                      <TouchableOpacity
                        key={dive.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: recorded || checked, disabled }}
                        disabled={disabled}
                        onPress={() => toggleDive(dive.id)}
                        style={[styles.diveOption, checked && styles.diveOptionSelected, recorded && styles.diveOptionRecorded]}
                      >
                        <View style={[styles.checkbox, (checked || recorded) && styles.checkboxSelected]}>{checked || recorded ? <Text style={styles.checkmark}>✓</Text> : null}</View>
                        <View style={styles.diveOptionCopy}>
                          <Text style={styles.diveOptionLocation}>{dive.location}</Text>
                          <Text style={styles.diveOptionMeta}>{dive.country} · {diveDate(dive.date).toLocaleDateString()}</Text>
                          {recorded || !known ? <Text style={styles.diveOptionStatus}>{recorded ? 'Already recorded on this dive' : 'Sightings unavailable'}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={saving || !selectedDiveIds.length}
              accessibilityState={{ disabled: saving || !selectedDiveIds.length, busy: saving }}
              onPress={saveSighting}
              style={[styles.saveButton, (!selectedDiveIds.length || saving) && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : `Add to ${selectedDiveIds.length} ${selectedDiveIds.length === 1 ? 'dive' : 'dives'}`}</Text>
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
  narrowHeaderRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 16 },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 20 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#526b7b', fontSize: 14, marginTop: 5 },
  headerStat: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#00A8A8' },
  headerStatValue: { color: '#0077CC', fontSize: 25, fontWeight: 'bold' },
  headerStatLabel: { color: '#647c8b', fontSize: 11 },
  searchInput: { minHeight: 48, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 24, paddingHorizontal: 16, color: '#1e293b', fontSize: 15 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 16 },
  categoryButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 20, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 9 },
  categoryButtonActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  categoryText: { color: '#0077CC', fontWeight: 'bold', fontSize: 13 },
  categoryTextActive: { color: '#fff' },
  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  albumCard: { backgroundColor: '#fff', borderRadius: 17, padding: 9, borderWidth: 1, borderColor: '#dce8ef' },
  albumCardShadow: { shadowColor: '#0077CC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  imageFrame: { width: '100%', height: 148, borderRadius: 12, overflow: 'hidden', backgroundColor: '#dcebf1', position: 'relative' },
  speciesImage: { width: '100%', height: '100%' },
  countBadge: { position: 'absolute', right: 8, top: 8, minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#0077CC', borderWidth: 2, borderColor: '#fff' },
  newBadge: { backgroundColor: '#00A8A8' },
  countText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  speciesName: { color: '#1e293b', fontWeight: 'bold', fontSize: 14, marginTop: 9, minHeight: 36 },
  speciesCategory: { color: '#526b7b', fontSize: 12, marginTop: 3 },
  statsCard: { marginTop: 28, backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#dce8ef' },
  statsTitle: { color: '#0077CC', fontSize: 18, fontWeight: 'bold' },
  statsSubtitle: { color: '#526b7b', fontSize: 12, marginTop: 3, marginBottom: 12 },
  chartViewport: { gap: 14 },
  chartColumn: { width: '100%' },
  chartHeading: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  chartTrack: { height: 10, borderRadius: 5, backgroundColor: '#e7f2f8', overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: 5, backgroundColor: '#00A8A8' },
  chartValue: { color: '#0077CC', fontSize: 13, fontWeight: 'bold' },
  chartLabel: { flex: 1, color: '#526b7b', fontSize: 13 },
  loader: { paddingVertical: 24 },
  errorText: { color: '#b42318', textAlign: 'center', padding: 20 },
  emptyText: { color: '#6b7c8d', textAlign: 'center', padding: 26 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '100%', flexShrink: 1, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 16 },
  modalScroll: { flexShrink: 1 },
  modalContent: { padding: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  modalTitleCopy: { flex: 1, paddingRight: 12 },
  modalEyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  modalTitle: { color: '#0077CC', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  modalSubtitle: { color: '#667b89', fontSize: 13, marginTop: 4 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef5f8', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0077CC', fontSize: 27, lineHeight: 29 },
  divePickerContent: { gap: 9, paddingVertical: 6 },
  diveOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce8ef', borderRadius: 14, padding: 12, backgroundColor: '#f9fcfd' },
  diveOptionSelected: { borderColor: '#00A8A8', backgroundColor: '#e9faf7' },
  diveOptionRecorded: { backgroundColor: '#eef5f8' },
  diveOptionStatus: { color: '#526b7b', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  checkboxSelected: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontWeight: 'bold' },
  diveOptionCopy: { flex: 1 },
  diveOptionLocation: { color: '#1e293b', fontWeight: 'bold' },
  diveOptionMeta: { color: '#526b7b', fontSize: 12, marginTop: 3 },
  saveButton: { minHeight: 48, borderRadius: 25, backgroundColor: '#0077CC', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
