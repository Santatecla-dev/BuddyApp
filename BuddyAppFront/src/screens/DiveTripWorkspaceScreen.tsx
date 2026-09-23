import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { DiveTrip, PlannedDive } from '../types';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function DiveTripWorkspaceScreen({ navigation, route }: any) {
  const tripId = route?.params?.tripId;
  const [trip, setTrip] = useState<DiveTrip | null>(null);
  const [plans, setPlans] = useState<PlannedDive[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchWorkspace = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [tripResponse, plansResponse] = await Promise.all([API.get(`/dive-trips/${tripId}`), API.get('/planned-dives')]);
      setTrip(tripResponse.data);
      setPlans(Array.isArray(plansResponse.data) ? plansResponse.data : []);
    } catch {
      setError('We could not load this trip workspace.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { fetchWorkspace(); }, [fetchWorkspace]));

  const attachedIds = useMemo(() => new Set((trip?.plannedDives || []).map((plan) => plan.id)), [trip]);
  const availablePlans = useMemo(() => {
    if (!trip) return [];
    const start = new Date(trip.startDate).getTime();
    const end = new Date(trip.endDate).getTime();
    return plans.filter((plan) => {
      const date = new Date(plan.date).getTime();
      return !attachedIds.has(plan.id) && date >= start && date <= end;
    });
  }, [attachedIds, plans, trip]);

  const attach = async (plan: PlannedDive) => {
    setBusyId(plan.id);
    try {
      const response = await API.post(`/dive-trips/${tripId}/planned-dives/${plan.id}`);
      setTrip(response.data);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      Alert.alert('Could not add dive', Array.isArray(message) ? message[0] : message || 'Please check the trip dates.');
    } finally { setBusyId(null); }
  };

  const detach = async (plan: PlannedDive) => {
    setBusyId(plan.id);
    try {
      const response = await API.delete(`/dive-trips/${tripId}/planned-dives/${plan.id}`);
      setTrip(response.data);
    } catch { Alert.alert('Could not remove dive', 'Please try again.'); }
    finally { setBusyId(null); }
  };

  const deleteTrip = () => {
    Alert.alert('Delete this trip?', 'Planned dives will remain available in your planner.', [
      { text: 'Keep trip', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await API.delete(`/dive-trips/${tripId}`); navigation.replace('DiveTrips'); }
        catch { Alert.alert('Could not delete trip', 'Please try again.'); }
      } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading trip workspace" color="#0077CC" /></View>;
  if (error || !trip) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error || 'Trip not found.'}</Text><TouchableOpacity style={styles.secondaryButton} onPress={fetchWorkspace}><Text style={styles.secondaryButtonText}>Retry</Text></TouchableOpacity></View>;

  const totalMinutes = trip.plannedDives.reduce((total, plan) => total + plan.duration, 0);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DIVE TRIP WORKSPACE</Text>
          <Text style={styles.title}>{trip.name}</Text>
          <Text style={styles.destination}>{trip.destination}</Text>
          <Text style={styles.dates}>{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summary}><Text style={styles.summaryValue}>{trip.plannedDives.length}</Text><Text style={styles.summaryLabel}>planned dives</Text></View>
          <View style={styles.summary}><Text style={styles.summaryValue}>{totalMinutes} min</Text><Text style={styles.summaryLabel}>underwater time</Text></View>
          <View style={styles.summary}><Text style={styles.summaryValue}>{availablePlans.length}</Text><Text style={styles.summaryLabel}>ready to add</Text></View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}><Text style={styles.panelTitle}>Trip itinerary</Text><Text style={styles.count}>{trip.plannedDives.length}</Text></View>
          {trip.plannedDives.length ? trip.plannedDives.map((plan) => (
            <View key={plan.id} style={styles.itineraryRow}>
              <View style={styles.dateColumn}><Text style={styles.day}>{new Date(plan.date).toLocaleDateString(undefined, { day: '2-digit' })}</Text><Text style={styles.month}>{new Date(plan.date).toLocaleDateString(undefined, { month: 'short' })}</Text></View>
              <TouchableOpacity style={styles.planCopy} onPress={() => navigation.navigate('PlannedDiveDetail', { planId: plan.id })}><Text style={styles.planTitle}>{plan.location}</Text><Text style={styles.planMeta}>{plan.maxDepth} m · {plan.duration} min · {plan.gas}</Text></TouchableOpacity>
              <TouchableOpacity accessibilityLabel={`Remove ${plan.location} from trip`} disabled={busyId === plan.id} onPress={() => detach(plan)} style={styles.removeButton}><Text style={styles.removeText}>×</Text></TouchableOpacity>
            </View>
          )) : <Text style={styles.muted}>No planned dives attached yet.</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Add a planned dive</Text>
          <Text style={styles.helper}>Only planned dives inside this trip's dates can be added.</Text>
          {availablePlans.length ? availablePlans.map((plan) => (
            <View key={plan.id} style={styles.availableRow}>
              <View style={styles.planCopy}><Text style={styles.planTitle}>{plan.location}</Text><Text style={styles.planMeta}>{formatDate(plan.date)} · {plan.country}</Text></View>
              <TouchableOpacity accessibilityRole="button" disabled={busyId === plan.id} style={[styles.addButton, busyId === plan.id && styles.disabled]} onPress={() => attach(plan)}><Text style={styles.addText}>{busyId === plan.id ? 'Adding…' : 'Add'}</Text></TouchableOpacity>
            </View>
          )) : <Text style={styles.muted}>There are no matching planned dives available.</Text>}
        </View>

        <View style={styles.notesPanel}><Text style={styles.panelTitle}>Trip notes</Text><Text style={styles.notes}>{trip.notes || 'No notes added for this trip.'}</Text></View>
        <TouchableOpacity accessibilityRole="button" style={styles.deleteButton} onPress={deleteTrip}><Text style={styles.deleteText}>Delete trip</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 20, paddingBottom: 45 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#a43b3b', textAlign: 'center', fontSize: 16 },
  hero: { backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 25, marginBottom: 16 },
  eyebrow: { color: '#00A8A8', fontWeight: 'bold', fontSize: 11, letterSpacing: 1.1 },
  title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 8 },
  destination: { color: '#334155', fontSize: 17, fontWeight: 'bold', marginTop: 7 },
  dates: { color: '#637789', fontSize: 14, marginTop: 5 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summary: { flex: 1, minWidth: 145, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 15 },
  summaryValue: { color: '#0077CC', fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { color: '#728396', fontSize: 12, marginTop: 3 },
  panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 20, marginBottom: 16 },
  panelHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: '#1e293b', fontSize: 19, fontWeight: 'bold' },
  count: { color: '#00A8A8', fontWeight: 'bold' },
  itineraryRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#edf2f5', marginTop: 13, paddingTop: 13, gap: 12 },
  dateColumn: { width: 48, alignItems: 'center', backgroundColor: '#e8faf7', borderRadius: 10, paddingVertical: 7 },
  day: { color: '#008d8d', fontSize: 19, fontWeight: 'bold' },
  month: { color: '#008d8d', fontSize: 11, textTransform: 'uppercase' },
  planCopy: { flex: 1, minWidth: 0 },
  planTitle: { color: '#1e293b', fontSize: 15, fontWeight: 'bold' },
  planMeta: { color: '#728396', fontSize: 12, marginTop: 4 },
  removeButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#dbe6ee', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#a43b3b', fontSize: 23, lineHeight: 21 },
  helper: { color: '#728396', fontSize: 13, marginTop: 5, marginBottom: 5 },
  availableRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#edf2f5', marginTop: 12, paddingTop: 12 },
  addButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 19, paddingHorizontal: 14, paddingVertical: 9 },
  addText: { color: '#008d8d', fontWeight: 'bold' },
  muted: { color: '#728396', marginTop: 14 },
  notesPanel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 20, marginBottom: 16 },
  notes: { color: '#526577', fontSize: 14, lineHeight: 21, marginTop: 11 },
  deleteButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#d59696', borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10 },
  deleteText: { color: '#a43b3b', fontWeight: 'bold' },
  secondaryButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold' },
  disabled: { opacity: 0.5 },
});
