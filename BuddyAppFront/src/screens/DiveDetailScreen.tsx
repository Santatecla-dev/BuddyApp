import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TextInput,
  Alert,
  Pressable,
  ScrollView,
  Modal,
} from 'react-native';
import API from '../api/api';
import { DiveBuddy, Dive, CenterLinkRequest, PokedexSpecies } from '../types';
import CenterSearchField from '../components/CenterSearchField';

export default function DiveDetailScreen({ route, navigation }: any) {
  const { diveId } = route.params;

  const [dive, setDive] = useState<Dive | null>(null);
  const [buddies, setBuddies] = useState<DiveBuddy[]>([]);
  const [myNotes, setMyNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [speciesCatalog, setSpeciesCatalog] = useState<PokedexSpecies[]>([]);
  const [sightings, setSightings] = useState<string[]>([]);
  const [sightingQuery, setSightingQuery] = useState('');
  const [savingSightings, setSavingSightings] = useState(false);
  const [centerRequests, setCenterRequests] = useState<CenterLinkRequest[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [requestingCenter, setRequestingCenter] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ location: '', date: '', maxDepth: '', duration: '', notes: '' });
  const [savingDive, setSavingDive] = useState(false);

  const fetchDive = async () => {
    setLoadError('');
    try {
      const res = await API.get<Dive>(`/dives/${diveId}`);
      setDive(res.data);

      const buddiesRes = await API.get(`/dives/${diveId}/buddies`);
      setBuddies(buddiesRes.data);

      const sightingsRes = await API.get(`/dives/${diveId}/sightings`);
      setSightings(sightingsRes.data.map((item: PokedexSpecies) => item.key));

      const requestsRes = await API.get<CenterLinkRequest[]>(`/dives/${diveId}/center-requests`);
      setCenterRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);

      try {
        const notesRes = await API.get(`/dives/${diveId}/personal-notes`);
        setMyNotes(notesRes.data.notes || '');
      } catch {}
    } catch (err) {
      setLoadError('Could not load dive details.');
    }
  };

  const extractMyUserId = () => {
    try {
      const authHeader = API.defaults.headers.common['Authorization'];
      if (typeof authHeader === 'string') {
        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(atob(token.split('.')[1]));
        setMyUserId(payload.userId);
      }
    } catch (err) {
      console.log('Could not retrieve userId', err);
    }
  };

  useEffect(() => {
    setDive(null);
    setBuddies([]);
    setMyNotes('');
    setSightingQuery('');
    fetchDive();
    extractMyUserId();
  }, [diveId]);

  useEffect(() => {
    API.get('/pokedex/species').then((response) => setSpeciesCatalog(response.data)).catch(() => setSpeciesCatalog([]));
  }, []);

  const requestCenter = async () => {
    if (!selectedCenterId) return;
    try {
      setRequestingCenter(true);
      const response = await API.post<CenterLinkRequest>(`/dives/${diveId}/center-requests`, { centerId: Number(selectedCenterId) });
      setCenterRequests((current) => [response.data, ...current]);
      setSelectedCenterId('');
      if (Platform.OS === 'web') window.alert('Request sent. The dive center must accept it before this dive is linked.');
      else Alert.alert('Request sent', 'The dive center must accept it before this dive is linked.');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Could not send the center request.';
      if (Platform.OS === 'web') window.alert(message); else Alert.alert('Error', message);
    } finally { setRequestingCenter(false); }
  };

  const toggleSighting = (speciesKey: string) => {
    setSightings((current) => current.includes(speciesKey)
      ? current.filter((key) => key !== speciesKey)
      : [...current, speciesKey]);
  };

  const filteredSpecies = useMemo(() => {
    const query = sightingQuery.trim().toLocaleLowerCase();
    if (!query) return speciesCatalog;
    return speciesCatalog.filter((species) => `${species.name} ${species.category}`.toLocaleLowerCase().includes(query));
  }, [sightingQuery, speciesCatalog]);

  const saveSightings = async () => {
    try {
      setSavingSightings(true);
      await API.put(`/dives/${diveId}/sightings`, { speciesKeys: sightings });
    } catch {
      if (Platform.OS === 'web') window.alert('Could not save sightings');
      else Alert.alert('Error', 'Could not save sightings');
    } finally {
      setSavingSightings(false);
    }
  };

  const saveMyNotes = async () => {
    try {
      setSavingNotes(true);
      await API.patch(`/dives/${diveId}/personal-notes`, { notes: myNotes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      console.error('Error saving notes');
      if (Platform.OS === 'web') {
        window.alert('Error: Could not save notes');
      } else {
        Alert.alert('Error', 'Could not save notes');
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const openEdit = () => {
    if (!dive) return;
    setEditForm({ location: dive.location, date: dive.date.slice(0, 16), maxDepth: String(dive.maxDepth), duration: String(dive.duration), notes: dive.notes || '' });
    setEditModal(true);
  };

  const saveDive = async () => {
    if (!dive || !editForm.location.trim()) return;
    setSavingDive(true);
    try {
      const response = await API.patch<Dive>(`/dives/${dive.id}`, { location: editForm.location.trim(), date: new Date(editForm.date).toISOString(), maxDepth: Number(editForm.maxDepth), duration: Number(editForm.duration), notes: editForm.notes.trim() || null });
      setDive((current) => current ? { ...current, ...response.data } : response.data);
      setEditModal(false);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Could not save dive changes.';
      if (Platform.OS === 'web') window.alert(message); else Alert.alert('Error', message);
    } finally { setSavingDive(false); }
  };

  const confirmLeaveDive = () => {
    const title = 'Leave dive';
    const message = 'Are you sure you want to leave this dive?';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        leaveDive();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leaveDive },
        ]
      );
    }
  };

  const leaveDive = async () => {
    try {
      await API.patch(`/dives/${diveId}/leave`);
      navigation.navigate('MyDives', { removeDiveId: diveId });
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Error: Could not leave the dive');
      } else {
        Alert.alert('Error', 'Could not leave the dive');
      }
    }
  };

  if (!dive) {
    return (
      <View style={styles.container}>
        <Text accessibilityRole={loadError ? 'alert' : undefined} style={styles.loading}>{loadError || 'Loading dive…'}</Text>
        {loadError ? <TouchableOpacity accessibilityRole="button" style={styles.shareButton} onPress={fetchDive}><Text style={styles.shareButtonText}>Retry</Text></TouchableOpacity> : null}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* MAIN CARD */}
      <View style={styles.card}>
        <Text style={styles.country}>{dive.country}</Text>

        <View style={styles.cardHeader}>
          <Text style={styles.title}>{dive.location}</Text>

          <View style={styles.headerActions}>{dive.canEdit ? <Pressable onPress={openEdit}><Text style={styles.editText}>Edit</Text></Pressable> : null}<Pressable onPress={confirmLeaveDive}><Text style={styles.leaveText}>Leave</Text></Pressable></View>
        </View>

        <Text style={styles.date}>
          {new Date(dive.date).toLocaleDateString()} ·{' '}
          {new Date(dive.date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {dive.center ? <View style={styles.centerBadge}><Text style={styles.centerBadgeLabel}>DIVE CENTER</Text><Text style={styles.centerBadgeName}>{dive.center.name}</Text></View> : null}

        {!dive.center ? <View style={styles.centerRequestBox}>
          <Text style={styles.centerRequestTitle}>Link this dive to a dive center</Text>
          <Text style={styles.centerRequestHint}>The center will review and accept your request before it appears on the dive.</Text>
          <CenterSearchField selectedCenterId={selectedCenterId} onSelect={(center) => setSelectedCenterId(center ? String(center.id) : '')} label="Dive center" hint="Search for the center that operated this dive." />
          <TouchableOpacity accessibilityRole="button" disabled={!selectedCenterId || requestingCenter} style={[styles.requestCenterButton, (!selectedCenterId || requestingCenter) && styles.requestDisabled]} onPress={requestCenter}><Text style={styles.requestCenterText}>{requestingCenter ? 'Sending…' : 'Request center link'}</Text></TouchableOpacity>
          {centerRequests.filter((request) => request.status === 'PENDING').map((request) => <Text key={request.id} style={styles.pendingCenterText}>Request pending for {request.center?.name || 'selected center'}</Text>)}
        </View> : null}

        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.shadow]}>
            <Text style={styles.statValue}>{dive.maxDepth} m</Text>
            <Text style={styles.statLabel}>Max Depth</Text>
          </View>

          <View style={[styles.statBox, styles.shadow]}>
            <Text style={styles.statValue}>{dive.duration} min</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => navigation.navigate('InviteBuddy', { diveId })}
        >
          <Text style={styles.shareButtonText}>Share dive</Text>
        </TouchableOpacity>
      </View>

      {/* NOTES */}
      <View style={[styles.notesCard, styles.shadow]}>
        <Text style={styles.sectionTitle}>Notes</Text>

        <TextInput
          accessibilityLabel="Personal notes"
          value={myNotes}
          onChangeText={setMyNotes}
          multiline
          style={styles.notesInput}
        />

        <TouchableOpacity accessibilityRole="button" disabled={savingNotes} accessibilityState={{ disabled: savingNotes, busy: savingNotes }} style={styles.saveButton} onPress={saveMyNotes}>
          <Text style={styles.saveButtonText}>
            {savingNotes ? 'Saving…' : saved ? 'Saved ✓' : 'Save notes'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.notesCard, styles.shadow, styles.sightingCard]}>
        <View style={styles.sightingHeading}>
          <View>
            <Text style={styles.sectionTitle}>Marine life sighted</Text>
            <Text style={styles.sightingHint}>One entry per species on this dive.</Text>
          </View>
          <Text style={styles.sightingCount}>{sightings.length}</Text>
        </View>
        <View style={styles.sightingSearchRow}>
          <TextInput
            accessibilityLabel="Search marine life"
            value={sightingQuery}
            onChangeText={setSightingQuery}
            placeholder="Search species or category"
            placeholderTextColor="#7890a0"
            style={styles.sightingSearchInput}
          />
          {sightingQuery ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear marine life search" style={styles.sightingClearButton} onPress={() => setSightingQuery('')}><Text style={styles.sightingClearText}>×</Text></TouchableOpacity> : null}
        </View>
        <Text style={styles.sightingResultHint}>{filteredSpecies.length} species{filteredSpecies.length === 1 ? '' : 's'} shown · {sightings.length} selected</Text>
        <ScrollView style={styles.sightingList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {filteredSpecies.map((species) => {
            const selected = sightings.includes(species.key);
            return (
              <TouchableOpacity
                key={species.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleSighting(species.key)}
                style={[styles.sightingListItem, selected && styles.sightingListItemSelected]}
              >
                <View style={[styles.sightingCheckbox, selected && styles.sightingCheckboxSelected]}><Text style={styles.sightingCheckboxText}>{selected ? '✓' : ''}</Text></View>
                <View style={styles.sightingListCopy}><Text numberOfLines={1} style={[styles.sightingListName, selected && styles.sightingNameSelected]}>{species.name}</Text><Text style={styles.sightingListCategory}>{species.category}</Text></View>
              </TouchableOpacity>
            );
          })}
          {!filteredSpecies.length ? <View style={styles.sightingEmpty}><Text style={styles.sightingEmptyTitle}>No species found</Text><Text style={styles.sightingEmptyText}>Try a different name or category.</Text></View> : null}
        </ScrollView>
        <TouchableOpacity accessibilityRole="button" disabled={savingSightings} style={styles.saveSightingsButton} onPress={saveSightings}>
          <Text style={styles.saveButtonText}>{savingSightings ? 'Saving…' : 'Save sightings'}</Text>
        </TouchableOpacity>
      </View>

      {/* BUDDIES */}
      <Text style={styles.sectionTitle}>Buddies</Text>

      {buddies.map(item => {
        const isMe = item.userId === myUserId;

        return (
          <TouchableOpacity
            key={item.userId}
            accessibilityRole="button"
            onPress={() => {
              navigation.navigate('Profile', { userId: isMe ? undefined : item.userId });
            }}
            style={[
              styles.buddyCard,
              styles.shadow,
              isMe && styles.myBuddyCard,
            ]}
            activeOpacity={isMe ? 1 : 0.7}
          >
            <View style={styles.buddyRow}>
              <Text style={styles.buddyName}>{item.name}</Text>
              {isMe && <Text style={styles.meBadge}>You</Text>}
            </View>
            <Text style={styles.buddyEmail}>{item.email}</Text>
          </TouchableOpacity>
        );
      })}
      {buddies.length === 0 && (
        <Text style={styles.emptyText}>
          No buddies in this dive yet 🤿
        </Text>
      )}
      {dive.canEdit ? <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}><View style={styles.editBackdrop}><View style={styles.editCard}><Text style={styles.editTitle}>Edit dive</Text><Text style={styles.editLabel}>Dive site</Text><TextInput accessibilityLabel="Dive site" value={editForm.location} onChangeText={(value) => setEditForm((current) => ({ ...current, location: value }))} style={styles.editInput} /><Text style={styles.editLabel}>Date and time</Text><TextInput accessibilityLabel="Dive date" value={editForm.date} onChangeText={(value) => setEditForm((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DDTHH:MM" style={styles.editInput} /><View style={styles.editRow}><View style={styles.editHalf}><Text style={styles.editLabel}>Max depth</Text><TextInput accessibilityLabel="Maximum depth" keyboardType="numeric" value={editForm.maxDepth} onChangeText={(value) => setEditForm((current) => ({ ...current, maxDepth: value }))} style={styles.editInput} /></View><View style={styles.editHalf}><Text style={styles.editLabel}>Duration</Text><TextInput accessibilityLabel="Duration" keyboardType="numeric" value={editForm.duration} onChangeText={(value) => setEditForm((current) => ({ ...current, duration: value }))} style={styles.editInput} /></View></View><Text style={styles.editLabel}>Notes</Text><TextInput accessibilityLabel="Dive notes" multiline value={editForm.notes} onChangeText={(value) => setEditForm((current) => ({ ...current, notes: value }))} style={[styles.editInput, styles.editNotes]} /><View style={styles.editActions}><TouchableOpacity accessibilityRole="button" onPress={() => setEditModal(false)} style={styles.cancelEdit}><Text style={styles.cancelEditText}>Cancel</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={savingDive} onPress={saveDive} style={styles.saveEdit}><Text style={styles.saveEditText}>{savingDive ? 'Saving…' : 'Save changes'}</Text></TouchableOpacity></View></View></View></Modal> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, editText: { color: '#0077CC', fontWeight: 'bold' }, editBackdrop: { flex: 1, backgroundColor: 'rgba(8,34,48,.48)', justifyContent: 'center', padding: 18 }, editCard: { width: '100%', maxWidth: 600, maxHeight: '92%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20 }, editTitle: { color: '#164c67', fontSize: 22, fontWeight: 'bold' }, editLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', marginTop: 13, marginBottom: 5 }, editInput: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', backgroundColor: '#fff' }, editRow: { flexDirection: 'row', gap: 10 }, editHalf: { flex: 1, minWidth: 0 }, editNotes: { minHeight: 80, textAlignVertical: 'top' }, editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 }, cancelEdit: { padding: 12 }, cancelEditText: { color: '#637789', fontWeight: 'bold' }, saveEdit: { backgroundColor: '#0077CC', borderRadius: 20, paddingHorizontal: 17, paddingVertical: 11 }, saveEditText: { color: '#fff', fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  loading: { textAlign: 'center', marginTop: 40 },

  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 5 },
      android: { elevation: 5 },
    }),
  },

  shadow: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },

  country: { color: '#0077CC', fontWeight: 'bold' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', flexShrink: 1 }, 
  leaveText: { color: '#CC3B3B', fontWeight: '600' },
  date: { color: '#555', marginTop: 4, fontSize: 12 },
  centerBadge: { alignSelf: 'flex-start', backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7, marginTop: 12 },
  centerBadgeLabel: { color: '#008d8d', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.8 },
  centerBadgeName: { color: '#164c67', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  centerRequestBox: { marginTop: 14, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: '#c5e9f3', backgroundColor: '#f2fbfd' },
  centerRequestTitle: { color: '#164c67', fontWeight: 'bold', fontSize: 14 },
  centerRequestHint: { color: '#718394', fontSize: 11, marginTop: 4, marginBottom: 8 },
  centerPickerWrap: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
  centerPicker: { height: 44, color: '#334155' },
  requestCenterButton: { marginTop: 9, backgroundColor: '#00A8A8', padding: 11, borderRadius: 20, alignItems: 'center' },
  requestDisabled: { opacity: 0.5 },
  requestCenterText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  pendingCenterText: { color: '#008d78', fontSize: 11, marginTop: 8, fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  statBox: {
    flex: 1,
    backgroundColor: '#f2f8ff',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 120,
  },

  statValue: { fontSize: 20, fontWeight: 'bold', color: '#0077CC' },
  statLabel: { fontSize: 12 },

  shareButton: {
    marginTop: 20,
    backgroundColor: '#0077CC',
    padding: 14,
    borderRadius: 30,
    alignItems: 'center',
  },

  shareButtonText: { color: 'white', fontWeight: 'bold' },

  notesCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 5 },

  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    backgroundColor: 'white',
    color: '#333',
    fontSize: 15,
  },

  saveButton: {
    marginTop: 12,
    backgroundColor: '#00A8A8',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
  },

  saveButtonText: { color: 'white', fontWeight: 'bold' },

  sightingCard: { marginTop: 2 },
  sightingHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sightingHint: { color: '#718394', fontSize: 12, marginTop: -6, marginBottom: 12 },
  sightingCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#0077CC', color: '#fff', textAlign: 'center', lineHeight: 28, fontWeight: 'bold' },
  sightingSearchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  sightingSearchInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, color: '#334155', fontSize: 14, backgroundColor: '#fff' },
  sightingClearButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8f2f6', alignItems: 'center', justifyContent: 'center', marginLeft: -40, marginRight: 5 },
  sightingClearText: { color: '#557180', fontSize: 21, lineHeight: 22 },
  sightingResultHint: { color: '#718394', fontSize: 11, marginBottom: 8 },
  sightingList: { maxHeight: 360, borderWidth: 1, borderColor: '#dbe8ef', borderRadius: 12, backgroundColor: '#fbfdfe' },
  sightingListItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#e8f0f3' },
  sightingListItemSelected: { backgroundColor: '#e6faf6', borderLeftWidth: 4, borderLeftColor: '#00A8A8', paddingLeft: 8 },
  sightingCheckbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, borderColor: '#a8bec9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sightingCheckboxSelected: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  sightingCheckboxText: { color: '#fff', fontSize: 15, lineHeight: 17, fontWeight: 'bold' },
  sightingListCopy: { flex: 1, minWidth: 0 },
  sightingListName: { color: '#41596b', fontSize: 13, fontWeight: 'bold' },
  sightingNameSelected: { color: '#008d8d' },
  sightingListCategory: { color: '#7890a0', fontSize: 11, marginTop: 3 },
  sightingEmpty: { padding: 22, alignItems: 'center' },
  sightingEmptyTitle: { color: '#164c67', fontWeight: 'bold' },
  sightingEmptyText: { color: '#718394', fontSize: 12, marginTop: 4 },
  saveSightingsButton: { marginTop: 14, backgroundColor: '#00A8A8', padding: 12, borderRadius: 24, alignItems: 'center' },

  buddyCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },

  myBuddyCard: {
    borderWidth: 2,
    borderColor: '#0077CC',
    backgroundColor: '#f2f8ff',
  },

  buddyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  buddyName: { fontWeight: 'bold', fontSize: 15 },
  buddyEmail: { fontSize: 13, color: '#666' },

  meBadge: {
    backgroundColor: '#0077CC',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
  },

  emptyText: { textAlign: 'center', color: '#777', marginTop: 20, marginBottom: 30 },
});
