import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { PlannedDive } from '../types';
import { CHECKLIST, completeChecklist } from '../utils/plannedDiveChecklist';

const CHECKLIST_LABELS: Record<string, string> = Object.fromEntries(CHECKLIST.map(item => [item.id, item.label]));

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
  const [actionError, setActionError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    if (!plan || busy) return;
    setActionError('');
    setBusy(true);
    try {
      await API.post(`/planned-dives/${plan.id}/log`);
      navigation.replace('MyDives');
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      setActionError(Array.isArray(message) ? message.join(' ') : message || 'Could not log this dive. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const deletePlan = async () => {
    if (!plan || busy) return;
    setActionError('');
    setBusy(true);
    try {
      await API.delete(`/planned-dives/${plan.id}`);
      navigation.replace('PlannedDives');
    } catch {
      setActionError('Could not delete this plan. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading planned dive" color="#0077CC" /></View>;
  if (error || !plan) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error || 'Planned dive not found.'}</Text><TouchableOpacity style={styles.secondaryButton} onPress={fetchPlan}><Text style={styles.secondaryButtonText}>Retry</Text></TouchableOpacity></View>;

  const checklist = Object.entries(completeChecklist(plan.checklist));
  const completed = checklist.filter(([, value]) => value).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PLANNED DIVE</Text>
          <Text style={styles.title}>{plan.location}</Text>
          <Text style={styles.date}>{formatDate(plan.date)}</Text>
          <Text style={styles.country}>{plan.country} · {plan.buddy}</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.maxDepth} m</Text><Text style={styles.metricLabel}>max depth</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.duration} min</Text><Text style={styles.metricLabel}>duration</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.gas}</Text><Text style={styles.metricLabel}>gas mix</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{plan.shoreEntry ? 'Shore' : 'Boat'}</Text><Text style={styles.metricLabel}>entry</Text></View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}><Text style={styles.panelTitle}>Equipment checklist</Text><Text style={styles.progress}>{completed}/{checklist.length || 0}</Text></View>
          {checklist.length ? checklist.map(([id, checked]) => (
            <View key={id} style={styles.checkItem} accessible accessibilityLabel={`${CHECKLIST_LABELS[id] || id}: ${checked ? 'Ready' : 'Not ready'}`}>
              <View style={[styles.checkbox, checked && styles.checkboxDone]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View>
              <Text style={[styles.checkLabel, checked && styles.checkLabelDone]}>{CHECKLIST_LABELS[id] || id}</Text>
            </View>
          )) : <Text style={styles.muted}>No checklist items were added.</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Conditions and notes</Text>
          <Text style={styles.condition}>{plan.condition}</Text>
          <Text style={styles.notes}>{plan.notes || 'No notes added for this plan.'}</Text>
        </View>

        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
        {confirmDelete && <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.panelTitle}>Delete planned dive?</Text>
          <Text style={styles.notes}>This removes the plan without creating a logged dive.</Text>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.secondaryButton} onPress={() => setConfirmDelete(false)}><Text style={styles.secondaryButtonText}>Keep plan</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.deleteButton} onPress={deletePlan}><Text style={styles.deleteButtonText}>Confirm delete</Text></TouchableOpacity>
          </View>
        </View>}
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.logButton, busy && styles.disabled]} onPress={logDive}><Text style={styles.logButtonText}>{busy ? 'Working…' : 'Log this dive'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy || confirmDelete} style={styles.deleteButton} onPress={() => setConfirmDelete(true)}><Text style={styles.deleteButtonText}>Delete plan</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc', overflow: 'hidden' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#a43b3b', fontSize: 16, textAlign: 'center' },
  hero: { backgroundColor: '#e7f6fb', borderRadius: 22, borderWidth: 1, borderColor: '#c5e9f3', padding: 25, marginBottom: 16 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 8 },
  date: { color: '#334155', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  country: { color: '#637789', fontSize: 14, marginTop: 5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metric: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0, minHeight: 84, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 15 },
  metricValue: { color: '#0077CC', fontSize: 17, fontWeight: 'bold' },
  metricLabel: { color: '#728396', fontSize: 12, marginTop: 4 },
  panel: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe6ee', padding: 20, marginBottom: 16 },
  panelHeading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  panelTitle: { color: '#1e293b', fontSize: 19, fontWeight: 'bold' },
  progress: { color: '#007f83', backgroundColor: '#e2f7f5', fontWeight: 'bold', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  checkItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#edf2f5', gap: 10, paddingHorizontal: 3, paddingVertical: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontWeight: 'bold' },
  checkLabel: { color: '#334155', fontSize: 14, flex: 1 },
  checkLabelDone: { color: '#007f83' },
  condition: { color: '#008d8d', fontWeight: 'bold', marginTop: 12 },
  notes: { color: '#526577', fontSize: 14, lineHeight: 21, marginTop: 12 },
  muted: { color: '#728396', marginTop: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  logButton: { flexGrow: 1, flexShrink: 1, flexBasis: 220, backgroundColor: '#0077CC', borderRadius: 24, padding: 14, alignItems: 'center' },
  logButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  deleteButton: { flexGrow: 1, flexShrink: 1, flexBasis: 160, borderWidth: 1, borderColor: '#e6bcbc', backgroundColor: '#fff', borderRadius: 24, padding: 13, alignItems: 'center' },
  deleteButtonText: { color: '#a43b3b', fontWeight: 'bold' },
  secondaryButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold' },
  disabled: { opacity: 0.55 },
});
