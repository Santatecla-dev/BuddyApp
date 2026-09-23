import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { DiveTrip } from '../types';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const tripLength = (trip: DiveTrip) => {
  const start = new Date(trip.startDate).getTime();
  const end = new Date(trip.endDate).getTime();
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

const parseTripDate = (value: string) => {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const european = /^(\d{1,2})[-\/]?(\d{1,2})[-\/]?(\d{4})$/.exec(trimmed);
  const year = iso ? Number(iso[1]) : european ? Number(european[3]) : 0;
  const month = iso ? Number(iso[2]) : european ? Number(european[2]) : 0;
  const day = iso ? Number(iso[3]) : european ? Number(european[1]) : 0;
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export default function DiveTripsScreen({ navigation }: any) {
  const [trips, setTrips] = useState<DiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/dive-trips');
      if (!Array.isArray(response.data)) throw new Error('Invalid trips response');
      setTrips(response.data);
    } catch {
      setError('We could not load your dive trips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchTrips(); }, [fetchTrips]));

  const upcomingTrips = useMemo(() => trips.filter((trip) => trip.status === 'upcoming'), [trips]);

  const resetForm = () => {
    setName(''); setDestination(''); setStartDate(''); setEndDate(''); setNotes(''); setFormError('');
  };

  const saveTrip = async () => {
    setFormError('');
    if (!name.trim() || !destination.trim() || !startDate || !endDate) {
      setFormError('Add a name, destination, start date and end date.');
      return;
    }
    const start = parseTripDate(startDate);
    const end = parseTripDate(endDate);
    if (!start || !end) {
      setFormError('Use a valid date such as 2026-09-25 or 25/09/2026.');
      return;
    }
    if (end < start) {
      setFormError('The end date must be after the start date.');
      return;
    }
    setSaving(true);
    try {
      await API.post('/dive-trips', {
        name: name.trim(), destination: destination.trim(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        notes: notes.trim() || undefined,
      });
      setModalVisible(false);
      resetForm();
      fetchTrips();
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      const readableMessage = Array.isArray(message) ? message[0] : message || 'Please try again.';
      setFormError(readableMessage);
      Alert.alert('Could not create trip', readableMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>TRIP WORKSPACE</Text>
            <Text style={styles.title}>Dive trips</Text>
            <Text style={styles.subtitle}>Bring your planned dives, buddies and travel notes into one simple itinerary.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.primaryButtonText}>+ New trip</Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator accessibilityLabel="Loading dive trips" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? <View style={styles.emptyCard}><Text accessibilityRole="alert" style={styles.emptyTitle}>{error}</Text><TouchableOpacity style={styles.secondaryButton} onPress={fetchTrips}><Text style={styles.secondaryButtonText}>Retry</Text></TouchableOpacity></View> : null}
        {!loading && !error && upcomingTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>Your next adventure starts here</Text>
            <Text style={styles.emptyText}>Create a trip and attach the dives you are preparing.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => setModalVisible(true)}><Text style={styles.primaryButtonText}>Create a trip</Text></TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.grid}>
          {upcomingTrips.map((trip) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Open trip ${trip.name}`}
              key={trip.id}
              style={styles.card}
              onPress={() => navigation.navigate('DiveTripWorkspace', { tripId: trip.id })}
            >
              <View style={styles.cardHeader}><Text style={styles.cardEyebrow}>{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</Text><Text style={styles.chevron}>›</Text></View>
              <Text style={styles.cardTitle}>{trip.name}</Text>
              <Text style={styles.destination}>{trip.destination}</Text>
              <View style={styles.cardStats}>
                <Text style={styles.stat}>{tripLength(trip)}</Text>
                <Text style={styles.stat}>{trip.plannedDives.length} planned {trip.plannedDives.length === 1 ? 'dive' : 'dives'}</Text>
              </View>
              <Text style={styles.cardNotes} numberOfLines={2}>{trip.notes || 'No trip notes yet.'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Create a dive trip</Text><TouchableOpacity accessibilityLabel="Close create trip dialog" onPress={() => setModalVisible(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View>
            <Text style={styles.label}>Trip name</Text>
            <TextInput accessibilityLabel="Trip name" placeholder="Red Sea week" value={name} onChangeText={setName} style={styles.input} />
            <Text style={styles.label}>Destination</Text>
            <TextInput accessibilityLabel="Trip destination" placeholder="Sharm El Sheikh" value={destination} onChangeText={setDestination} style={styles.input} />
            <View style={styles.twoFields}>
              <View style={styles.field}><Text style={styles.label}>Start</Text><TextInput accessibilityLabel="Trip start date" placeholder="YYYY-MM-DD" value={startDate} onChangeText={setStartDate} style={styles.input} /></View>
              <View style={styles.field}><Text style={styles.label}>End</Text><TextInput accessibilityLabel="Trip end date" placeholder="YYYY-MM-DD" value={endDate} onChangeText={setEndDate} style={styles.input} /></View>
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput accessibilityLabel="Trip notes" placeholder="Boat, hotel or meeting point" multiline value={notes} onChangeText={setNotes} style={[styles.input, styles.notesInput]} />
            {formError ? <Text accessibilityRole="alert" style={styles.formError}>{formError}</Text> : null}
            <View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => { setModalVisible(false); setFormError(''); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={saveTrip}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Create trip'}</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 45 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderRadius: 22, borderWidth: 1, borderColor: '#c5e9f3', padding: 24, marginBottom: 18, gap: 16 },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 7 },
  title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, lineHeight: 21, marginTop: 7 },
  primaryButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  loader: { marginTop: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { flexGrow: 1, flexBasis: Platform.OS === 'web' ? 330 : 300, minWidth: 280, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 19 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: '#00A8A8', fontWeight: 'bold', fontSize: 12, flex: 1 },
  chevron: { color: '#0077CC', fontSize: 25 },
  cardTitle: { color: '#1e293b', fontSize: 22, fontWeight: 'bold', marginTop: 13 },
  destination: { color: '#637789', fontSize: 14, marginTop: 4 },
  cardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  stat: { color: '#35596f', fontWeight: 'bold', backgroundColor: '#f1f8fc', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, fontSize: 12 },
  cardNotes: { color: '#728396', fontSize: 13, lineHeight: 18, marginTop: 17 },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 30, alignItems: 'center' },
  emptyIcon: { color: '#00A8A8', fontSize: 35, marginBottom: 5 },
  emptyTitle: { color: '#1e293b', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  emptyText: { color: '#637789', fontSize: 14, textAlign: 'center', marginVertical: 8 },
  secondaryButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '92%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 23 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#1e293b', fontSize: 21, fontWeight: 'bold' },
  close: { color: '#637789', fontSize: 30, lineHeight: 30, paddingHorizontal: 5 },
  label: { color: '#334155', fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, color: '#1e293b', backgroundColor: '#fff' },
  twoFields: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, minWidth: 0 },
  notesInput: { minHeight: 82, textAlignVertical: 'top' },
  formError: { color: '#a43b3b', fontSize: 13, fontWeight: 'bold', lineHeight: 18, marginTop: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 21 },
  cancelButton: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 11 },
  cancelText: { color: '#35596f', fontWeight: 'bold' },
  disabled: { opacity: 0.55 },
});
