import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { PlannedDive } from '../types';

const CHECKLIST_LABELS: Record<string, string> = {
  mask: 'Mask and spare mask', fins: 'Fins and boots', computer: 'Dive computer charged',
  buoyancy: 'BCD inflator tested', regulator: 'Regulator and alternate air source',
  tank: 'Tank visual inspection complete', weights: 'Weights and quick-release checked',
  surface: 'Surface marker and whistle packed', 'first-aid': 'First aid kit and emergency contacts',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
};

export default function PlannedDiveDetailScreen({ navigation, route }: any) {
  const planId = route?.params?.planId;
  const [plan, setPlan] = useState<PlannedDive | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get(`/planned-dives/${planId}`);
      setPlan(response.data);
    } catch {
      setError('This planned dive is no longer available.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useFocusEffect(useCallback(() => { fetchPlan(); }, [fetchPlan]));

  const logDive = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await API.post(`/planned-dives/${plan.id}/log`);
      navigation.replace('MyDives');
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      Alert.alert('Could not log dive', Array.isArray(message) ? message[0] : message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const deletePlan = () => {
    if (!plan) return;
    Alert.alert('Delete planned dive?', 'This removes the plan without creating a logged dive.', [
      { text: 'Keep plan', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await API.delete(`/planned-dives/${plan.id}`);
          navigation.replace('PlannedDives');
        } catch {
          Alert.alert('Could not delete plan', 'Please try again.');
        } finally {
          setBusy(false);
        }
      } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading planned dive" color="#0077CC" /></View>;
  if (error || !plan) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error || 'Planned dive not found.'}</Text><TouchableOpacity style={styles.secondaryButton} onPress={fetchPlan}><Text style={styles.secondaryButtonText}>Retry</Text></TouchableOpacity></View>;

  const checklist = Object.entries(plan.checklist || {});
  const completed = checklist.filter(([, value]) => value).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PLANNED DIVE</Text>
          <Text style={styles.title} numberOfLines={1}>{plan.location}</Text>
          <Text style={styles.date}>{formatDate(plan.date)}</Text>
          <Text style={styles.country}>{plan.country} · {plan.buddy}</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.maxDepth} m</Text><Text style={styles.metricLabel}>max depth</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.duration} min</Text><Text style={styles.metricLabel}>duration</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.gas}</Text><Text style={styles.metricLabel}>gas mix</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.shoreEntry ? 'Shore' : 'Boat'}</Text><Text style={styles.metricLabel}>entry</Text></View>
        </View>

        <View style={[styles.panel, styles.panelInset]}>
          <View style={styles.panelHeading}><Text style={styles.panelTitle}>Equipment checklist</Text><Text style={styles.progress}>{completed}/{checklist.length || 0}</Text></View>
          {checklist.length ? checklist.map(([id, checked]) => (
            <View key={id} style={styles.checkItem}>
              <View style={[styles.checkbox, checked && styles.checkboxDone]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View>
              <Text style={[styles.checkLabel, checked && styles.checkLabelDone]} numberOfLines={1}>{CHECKLIST_LABELS[id] || id}</Text>
            </View>
          )) : <Text style={styles.muted}>No checklist items were added.</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Conditions and notes</Text>
          <Text style={styles.condition}>{plan.condition}</Text>
          <Text style={styles.notes} numberOfLines={2}>{plan.notes || 'No notes added for this plan.'}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.logButton, busy && styles.disabled]} onPress={logDive}><Text style={styles.logButtonText}>{busy ? 'Working…' : 'Log this dive'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.deleteButton} onPress={deletePlan}><Text style={styles.deleteButtonText}>Delete plan</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc', overflow: 'hidden' },
  content: { width: '100%', minWidth: 760, maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#a43b3b', fontSize: 16, textAlign: 'center' },
  hero: { minWidth: 720, height: 190, backgroundColor: '#e7f6fb', borderRadius: 22, borderWidth: 1, borderColor: '#c5e9f3', padding: 25, marginBottom: 16, overflow: 'hidden' },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 8, width: 440 },
  date: { color: '#334155', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  country: { color: '#637789', fontSize: 14, marginTop: 5 },
  metrics: { flexDirection: 'row', flexWrap: 'nowrap', gap: 10, marginBottom: 16 },
  metric: { flex: 1, minWidth: 185, height: 84, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 15, overflow: 'hidden' },
  metricValue: { color: '#0077CC', fontSize: 17, fontWeight: 'bold' },
  metricLabel: { color: '#728396', fontSize: 12, marginTop: 4 },
  panel: { minWidth: 720, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe6ee', padding: 20, marginBottom: 16, overflow: 'hidden' },
  panelInset: { height: 238, maxHeight: 238, overflow: 'hidden' },
  panelHeading: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, width: 680 },
  panelTitle: { color: '#1e293b', fontSize: 19, fontWeight: 'bold' },
  progress: { color: '#dbe6ee', backgroundColor: '#dbe6ee', fontWeight: 'bold', paddingHorizontal: 7 },
  checkItem: { minHeight: 48, width: 680, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#edf2f5', gap: 10, paddingHorizontal: 3 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontWeight: 'bold' },
  checkLabel: { color: '#334155', fontSize: 14, flex: 1 },
  checkLabelDone: { color: '#fff' },
  condition: { color: '#008d8d', fontWeight: 'bold', marginTop: 12 },
  notes: { color: '#526577', fontSize: 14, lineHeight: 21, marginTop: 12, maxHeight: 43, overflow: 'hidden' },
  muted: { color: '#728396', marginTop: 13 },
  actions: { flexDirection: 'row', flexWrap: 'nowrap', gap: 10, marginTop: 2, width: 760 },
  logButton: { width: 390, backgroundColor: '#0077CC', borderRadius: 24, padding: 14, alignItems: 'center' },
  logButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  deleteButton: { width: 300, borderWidth: 1, borderColor: '#f7f9fc', backgroundColor: '#f7f9fc', borderRadius: 24, padding: 13, alignItems: 'center' },
  deleteButtonText: { color: '#a43b3b', fontWeight: 'bold' },
  secondaryButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold' },
  disabled: { opacity: 0.55 },
});
