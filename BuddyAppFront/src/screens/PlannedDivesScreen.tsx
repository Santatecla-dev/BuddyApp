import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { PlannedDive } from '../types';

type Filter = 'all' | 'week' | 'later';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

const checklistProgress = (plan: PlannedDive) => {
  const values = Object.values(plan.checklist || {});
  return { done: values.filter(Boolean).length, total: values.length };
};

export default function PlannedDivesScreen({ navigation }: any) {
  const [plans, setPlans] = useState<PlannedDive[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/planned-dives');
      if (!Array.isArray(response.data)) throw new Error('Unexpected planned dives response');
      setPlans(response.data);
    } catch {
      setError('We could not load your planned dives.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchPlans();
  }, [fetchPlans]));

  const visiblePlans = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * 86400000;
    const normalizedQuery = query.trim().toLowerCase();
    return plans.filter((plan) => {
      const timestamp = new Date(plan.date).getTime();
      const matchesFilter = filter === 'all'
        || (filter === 'week' && timestamp <= week)
        || (filter === 'later' && timestamp > week);
      const matchesQuery = !normalizedQuery
        || `${plan.location} ${plan.country} ${plan.buddy}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, plans, query]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>DIVE PLANNER</Text>
            <Text style={styles.title}>Planned dives</Text>
            <Text style={styles.subtitle}>Keep upcoming dives, checklists and buddies together until you log them.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => navigation.navigate('PlanDive')}>
            <Text style={styles.primaryButtonText}>+ Plan a dive</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolbar}>
          <TextInput
            accessibilityLabel="Search planned dives"
            placeholder="Search site, country or buddy"
            placeholderTextColor="#7890a0"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
          <View style={styles.filters}>
            {([['all', 'All'], ['week', 'Next 7 days'], ['later', 'Later']] as [Filter, string][]).map(([value, label]) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                key={value}
                onPress={() => setFilter(value)}
                style={[styles.filterChip, filter === value && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? <ActivityIndicator accessibilityLabel="Loading planned dives" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? (
          <View style={styles.emptyCard}>
            <Text accessibilityRole="alert" style={styles.emptyTitle}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={fetchPlans}><Text style={styles.secondaryButtonText}>Retry</Text></TouchableOpacity>
          </View>
        ) : null}
        {!loading && !error && visiblePlans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◌</Text>
            <Text style={styles.emptyTitle}>{plans.length ? 'No matching planned dives' : 'No dives planned yet'}</Text>
            <Text style={styles.emptyText}>{plans.length ? 'Try another search or filter.' : 'Prepare your next adventure and keep its checklist ready.'}</Text>
            {!plans.length ? <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => navigation.navigate('PlanDive')}><Text style={styles.primaryButtonText}>Plan your first dive</Text></TouchableOpacity> : null}
          </View>
        ) : null}

        <View style={styles.grid}>
          {visiblePlans.map((plan) => {
            const progress = checklistProgress(plan);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Open planned dive at ${plan.location}`}
                key={plan.id}
                style={styles.card}
                onPress={() => navigation.navigate('PlannedDiveDetail', { planId: plan.id })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.date}>{formatDate(plan.date)}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.location} numberOfLines={1}>{plan.location}</Text>
                <Text style={styles.country}>{plan.country} · {plan.buddy}</Text>
                <View style={styles.metrics}>
                  <Text style={styles.metric}>{plan.maxDepth} m</Text>
                  <Text style={styles.metric}>{plan.duration} min</Text>
                  <Text style={styles.metric}>{plan.gas}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.condition}>{plan.condition}</Text>
                  <Text style={styles.progress}>{progress.total ? `${progress.done}/${progress.total} ready` : 'Checklist not started'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc', overflow: 'hidden' },
  content: { width: '100%', minWidth: 900, maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 42 },
  hero: { minWidth: 860, flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderRadius: 22, padding: 24, marginBottom: 18, borderWidth: 1, borderColor: '#c5e9f3', gap: 16 },
  heroCopy: { flex: 1, minWidth: 620 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 7 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, marginTop: 7, lineHeight: 21 },
  primaryButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  toolbar: { flexDirection: 'row', flexWrap: 'nowrap', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#dbe6ee', padding: 14, marginBottom: 18, gap: 12 },
  searchInput: { width: 510, minHeight: 46, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 13, paddingHorizontal: 13, color: '#fff', fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8 },
  filterChip: { minWidth: 115, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#fff', borderColor: '#b8d8ee' },
  filterText: { color: '#0077CC', fontWeight: 'bold', fontSize: 13 },
  filterTextActive: { color: '#b8d8ee' },
  loader: { marginTop: 28 },
  grid: { height: 520, flexDirection: 'row', flexWrap: 'nowrap', gap: 16, overflow: 'hidden', paddingVertical: 2, paddingHorizontal: 6 },
  card: { flexGrow: 0, flexBasis: 360, width: 360, minWidth: 360, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe6ee', padding: 18, marginTop: 18, overflow: 'hidden', boxShadow: '0 18px 36px rgba(0, 119, 204, 0.42)' } as any,
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: '#00A8A8', fontWeight: 'bold', fontSize: 13 },
  chevron: { color: '#0077CC', fontSize: 25, lineHeight: 22 },
  location: { color: '#1e293b', fontSize: 21, fontWeight: 'bold', marginTop: 12, width: 245 },
  country: { color: '#637789', fontSize: 13, marginTop: 5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 17 },
  metric: { color: '#35596f', backgroundColor: '#f1f8fc', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, fontSize: 12, fontWeight: 'bold' },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#e7eef3', marginTop: 17, paddingTop: 12, flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between', gap: 8, height: 32, overflow: 'hidden' },
  condition: { color: '#008d8d', fontWeight: 'bold', fontSize: 13 },
  progress: { color: '#728396', fontSize: 12 },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 28, alignItems: 'center', marginBottom: 16 },
  emptyIcon: { color: '#00A8A8', fontSize: 38, marginBottom: 5 },
  emptyTitle: { color: '#1e293b', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  emptyText: { color: '#637789', fontSize: 14, textAlign: 'center', marginTop: 7, marginBottom: 16 },
  secondaryButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold' },
});
