import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import EquipmentForm from '../components/EquipmentForm';
import { getEquipmentStatus, isDueSoon } from '../utils/equipment';
import { Equipment, EquipmentCondition } from '../types';

const CATEGORIES = ['Regulator', 'BCD', 'Exposure', 'Computer', 'Camera', 'Accessories'];
const CONDITIONS: EquipmentCondition[] = ['good', 'service_due', 'retired'];
const CONDITION_LABELS: Record<EquipmentCondition, string> = { good: 'Ready', service_due: 'Service due', retired: 'Retired' };

const formatServiceDate = (value?: string | null) => {
  if (!value) return 'No service date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `Service by ${date.toLocaleDateString()}`;
};

export default function EquipmentScreen({ navigation }: any) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [condition, setCondition] = useState<'all' | EquipmentCondition>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [checklistChecks, setChecklistChecks] = useState<Record<string, boolean>>({});
  const packingRequests = useRef(new Set<number>());

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get<Equipment[]>('/equipment');
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch {
      setError('We could not load your equipment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadEquipment();
  }, [loadEquipment]));

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesQuery = !normalized || `${item.name} ${item.category} ${item.brand || ''} ${item.model || ''}`.toLocaleLowerCase().includes(normalized);
      return matchesQuery && (category === 'all' || item.category === category) && (condition === 'all' || getEquipmentStatus(item) === condition);
    });
  }, [category, condition, items, query]);

  const openCreate = () => { setEditing(null); setModalVisible(true); };
  const openEdit = (item: Equipment) => { setEditing(item); setModalVisible(true); };

  const togglePacked = async (item: Equipment) => {
    if (packingRequests.current.has(item.id)) return;
    packingRequests.current.add(item.id);
    setError('');
    try {
      await API.patch(`/equipment/${item.id}`, { packed: !item.packed });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, packed: !item.packed } : candidate));
    } catch {
      setError('Could not update the packing status.');
    } finally {
      packingRequests.current.delete(item.id);
    }
  };

  const removeEquipment = async (item: Equipment) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm(`Remove ${item.name}?`)) return;
    try {
      await API.delete(`/equipment/${item.id}`);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch {
      setError('Could not remove this equipment.');
    }
  };

  const dueCount = items.filter(isDueSoon).length;
  const packedCount = items.filter((item) => item.packed).length;
  const categoryStats = useMemo(() => CATEGORIES
    .map((name) => ({ name, count: items.filter((item) => item.category === name).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count), [items]);
  const maxCategoryCount = Math.max(1, ...categoryStats.map((entry) => entry.count));
  const attentionItems = useMemo(() => items
    .filter(isDueSoon)
    .sort((a, b) => {
      const aDate = a.nextServiceDate ? new Date(a.nextServiceDate).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.nextServiceDate ? new Date(b.nextServiceDate).getTime() : Number.POSITIVE_INFINITY;
      return aDate - bDate;
    })
    .slice(0, 3), [items]);
  const checklistItems = [
    { id: 'maintenance', label: 'Maintenance is up to date', detail: dueCount ? `${dueCount} item${dueCount === 1 ? '' : 's'} need attention` : 'No service dates are due soon', complete: items.length > 0 && dueCount === 0 },
    { id: 'packed', label: 'Current kit is packed', detail: items.length ? `${packedCount} of ${items.length} items marked packed` : 'Add equipment before packing', complete: items.length > 0 && packedCount === items.length },
    { id: 'inspection', label: 'Pre-dive visual inspection', detail: 'Check seals, clips, hoses and straps', complete: checklistChecks.inspection === true },
    { id: 'spares', label: 'Spares and batteries ready', detail: 'Confirm batteries, o-rings and tools', complete: checklistChecks.spares === true },
  ];
  const completedChecklist = checklistItems.filter((item) => item.complete).length;
  const readinessPercent = checklistItems.length ? Math.round((completedChecklist / checklistItems.length) * 100) : 0;

  const toggleChecklist = (id: string) => {
    setChecklistChecks((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroCopy}><Text style={styles.eyebrow}>DIVE KIT</Text><Text style={styles.title}>My equipment</Text><Text style={styles.subtitle}>Keep your gear, maintenance dates and packing status in one place.</Text></View>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={openCreate}><Text style={styles.primaryButtonText}>+ Add equipment</Text></TouchableOpacity>
        </View>

        <View style={styles.summaryRow}><View style={styles.summaryCard}><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>Total items</Text></View><View style={styles.summaryCard}><Text style={styles.summaryValue}>{dueCount}</Text><Text style={styles.summaryLabel}>Need attention</Text></View><View style={styles.summaryCard}><Text style={styles.summaryValue}>{packedCount}/{items.length || 0}</Text><Text style={styles.summaryLabel}>Packed</Text></View></View>

        <View style={styles.toolbar}><TextInput accessibilityLabel="Search equipment" value={query} onChangeText={setQuery} placeholder="Search gear, brand or model" placeholderTextColor="#7890a0" style={styles.searchInput} /><View style={styles.chipRow}><TouchableOpacity accessibilityRole="button" aria-selected={category === 'all'} accessibilityState={{ selected: category === 'all' }} onPress={() => setCategory('all')} style={[styles.chip, category === 'all' && styles.chipActive]}><Text style={[styles.chipText, category === 'all' && styles.chipTextActive]}>All</Text></TouchableOpacity>{CATEGORIES.map((value) => <TouchableOpacity accessibilityRole="button" aria-selected={category === value} accessibilityState={{ selected: category === value }} key={value} onPress={() => setCategory(value)} style={[styles.chip, category === value && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, category === value && styles.chipTextActive]}>{value}</Text></TouchableOpacity>)}</View><View style={styles.conditionRow}>{(['all', ...CONDITIONS] as const).map((value) => <TouchableOpacity accessibilityRole="button" aria-selected={condition === value} accessibilityState={{ selected: condition === value }} key={value} onPress={() => setCondition(value)} style={[styles.conditionChip, condition === value && styles.conditionChipActive]}><Text style={[styles.conditionText, condition === value && styles.conditionTextActive]}>{value === 'all' ? 'Any status' : CONDITION_LABELS[value]}</Text></TouchableOpacity>)}</View></View>

        {!loading && !error ? <View style={styles.dashboardGrid}>
          <View style={styles.dashboardCard}>
            <View style={styles.sectionHeader}><View><Text style={styles.dashboardEyebrow}>PRE-DIVE CHECK</Text><Text style={styles.dashboardTitle}>Kit readiness</Text></View><Text style={styles.readinessValue}>{readinessPercent}%</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${readinessPercent}%` }]} /></View>
            <Text style={styles.dashboardHint}>{completedChecklist} of {checklistItems.length} checks complete</Text>
            <View style={styles.checklistList}>{checklistItems.map((item) => <TouchableOpacity accessibilityRole="checkbox" aria-checked={item.complete} accessibilityState={{ checked: item.complete, disabled: item.id === 'maintenance' || item.id === 'packed' }} key={item.id} disabled={item.id === 'maintenance' || item.id === 'packed'} accessibilityHint={item.id === 'maintenance' || item.id === 'packed' ? 'Calculated from your equipment' : undefined} onPress={() => toggleChecklist(item.id)} style={styles.checklistRow}><View style={[styles.checkIcon, item.complete && styles.checkIconComplete]}><Text style={[styles.checkIconText, item.complete && styles.checkIconTextComplete]}>{item.complete ? '✓' : ''}</Text></View><View style={styles.checklistCopy}><Text style={[styles.checklistLabel, item.complete && styles.checklistLabelComplete]}>{item.label}</Text><Text style={styles.checklistDetail}>{item.detail}</Text></View></TouchableOpacity>)}</View>
          </View>
          <View style={styles.dashboardCard}>
            <View style={styles.sectionHeader}><View><Text style={styles.dashboardEyebrow}>KIT INSIGHTS</Text><Text style={styles.dashboardTitle}>Gear by category</Text></View><Text style={styles.dashboardMetric}>{items.length} total</Text></View>
            {categoryStats.length ? <View style={styles.categoryChart}>{categoryStats.map((entry) => <TouchableOpacity accessibilityRole="button" key={entry.name} onPress={() => setCategory(entry.name)} style={styles.categoryRow}><Text numberOfLines={1} style={styles.categoryName}>{entry.name}</Text><View style={styles.categoryBarTrack}><View style={[styles.categoryBar, { width: `${Math.max(8, (entry.count / maxCategoryCount) * 100)}%` }]} /></View><Text style={styles.categoryCount}>{entry.count}</Text></TouchableOpacity>)}</View> : <Text style={styles.dashboardEmpty}>Add equipment to see your kit mix.</Text>}
            <View style={styles.attentionBlock}><View style={styles.attentionHeader}><Text style={styles.attentionTitle}>Next maintenance</Text><Text style={styles.attentionCount}>{dueCount}</Text></View>{attentionItems.length ? attentionItems.map((item) => <TouchableOpacity accessibilityRole="button" key={item.id} style={styles.attentionItem} onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: item.id })}><View style={styles.attentionCopy}><Text numberOfLines={1} style={styles.attentionName}>{item.name}</Text><Text style={styles.attentionDate}>{formatServiceDate(item.nextServiceDate)}</Text></View><Text style={styles.attentionArrow}>›</Text></TouchableOpacity>) : <Text style={styles.attentionEmpty}>Nothing needs attention in the next 30 days.</Text>}</View>
          </View>
        </View> : null}

        {loading ? <ActivityIndicator accessibilityLabel="Loading equipment" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={loadEquipment}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
        {!loading && !error && visibleItems.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>◌</Text><Text style={styles.emptyTitle}>{items.length ? 'No equipment matches' : 'Your kit is empty'}</Text><Text style={styles.emptyText}>{items.length ? 'Try another search or filter.' : 'Add your first piece of dive gear to get started.'}</Text>{!items.length ? <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={openCreate}><Text style={styles.secondaryButtonText}>Add first item</Text></TouchableOpacity> : null}</View> : null}

        <View style={styles.grid}>{visibleItems.map((item) => <View key={item.id} style={[styles.card, item.condition === 'retired' && styles.retiredCard]}>
          <View style={styles.cardTop}><Text style={styles.categoryLabel}>{item.category}</Text><View style={[styles.statusBadge, getEquipmentStatus(item) === 'service_due' && styles.dueBadge, item.condition === 'retired' && styles.retiredBadge]}><Text style={styles.statusText}>{CONDITION_LABELS[getEquipmentStatus(item)]}</Text></View></View>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemBrand}>{[item.brand, item.model].filter(Boolean).join(' ') || 'Brand and model not specified'}</Text>
          <Text style={styles.serviceDate}>{formatServiceDate(item.nextServiceDate)}</Text>
          <View style={styles.cardFooter}><TouchableOpacity accessibilityRole="checkbox" aria-checked={item.packed} accessibilityState={{ checked: item.packed }} onPress={() => togglePacked(item)} style={[styles.packButton, item.packed && styles.packButtonActive]}><Text style={[styles.packText, item.packed && styles.packTextActive]}>{item.packed ? '✓ Packed' : 'Mark packed'}</Text></TouchableOpacity><View style={styles.cardActions}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open details for ${item.name}`} onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: item.id })}><Text style={styles.actionText}>Details</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => openEdit(item)}><Text style={styles.actionText}>Edit</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => removeEquipment(item)}><Text style={styles.deleteText}>Remove</Text></TouchableOpacity></View></View>
        </View>)}</View>
      </ScrollView>

      {modalVisible ? <EquipmentForm editing={editing} onClose={() => setModalVisible(false)} onSaved={loadEquipment} /> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 24, marginBottom: 18 },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#425466', fontSize: 15, lineHeight: 21, marginTop: 7 },
  primaryButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  summaryCard: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0, padding: 15, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee' },
  summaryValue: { color: '#0077CC', fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { color: '#6a7d8d', fontSize: 12, marginTop: 4 },
  toolbar: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 14, marginBottom: 18 },
  searchInput: { minHeight: 46, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 12, paddingHorizontal: 13, color: '#334155', fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 17, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 130 },
  chipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  chipText: { color: '#0077CC', fontWeight: 'bold', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  conditionChip: { borderBottomWidth: 2, borderBottomColor: '#dbe6ee', paddingHorizontal: 5, paddingVertical: 7 },
  conditionChipActive: { borderBottomColor: '#00A8A8' },
  conditionText: { color: '#7890a0', fontSize: 12 },
  conditionTextActive: { color: '#008d8d', fontWeight: 'bold' },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  dashboardCard: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 17, padding: 17 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  dashboardEyebrow: { color: '#00A8A8', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  dashboardTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  readinessValue: { color: '#0077CC', fontSize: 25, fontWeight: 'bold' },
  dashboardMetric: { color: '#6a7d8d', fontSize: 12, marginTop: 6 },
  progressTrack: { height: 9, backgroundColor: '#e5eef3', borderRadius: 6, overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: '#00A8A8', borderRadius: 6 },
  dashboardHint: { color: '#6a7d8d', fontSize: 12, marginTop: 7 },
  checklistList: { gap: 4, marginTop: 13 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 5, marginLeft: -5 },
  checkIcon: { width: 23, height: 23, flexShrink: 0, borderRadius: 7, borderWidth: 1.5, borderColor: '#9db6c2', alignItems: 'center', justifyContent: 'center' },
  checkIconComplete: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkIconText: { color: '#9db6c2', fontSize: 15, fontWeight: 'bold', lineHeight: 17 },
  checkIconTextComplete: { color: '#fff' },
  checklistCopy: { flex: 1, minWidth: 0 },
  checklistLabel: { color: '#164c67', fontSize: 13, fontWeight: '600' },
  checklistLabelComplete: { color: '#008d78' },
  checklistDetail: { color: '#7890a0', fontSize: 11, marginTop: 2 },
  categoryChart: { gap: 9, marginTop: 17 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  categoryName: { width: 82, flexShrink: 1, color: '#526a79', fontSize: 11 },
  categoryBarTrack: { flex: 1, minWidth: 0, height: 9, backgroundColor: '#edf3f6', borderRadius: 6, overflow: 'hidden' },
  categoryBar: { height: '100%', backgroundColor: '#55acd2', borderRadius: 6 },
  categoryCount: { width: 18, textAlign: 'right', color: '#164c67', fontSize: 12, fontWeight: 'bold' },
  dashboardEmpty: { color: '#6a7d8d', marginTop: 18 },
  attentionBlock: { borderTopWidth: 1, borderTopColor: '#e7eef3', marginTop: 18, paddingTop: 14 },
  attentionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attentionTitle: { color: '#164c67', fontSize: 14, fontWeight: 'bold' },
  attentionCount: { minWidth: 23, textAlign: 'center', color: '#a96a13', backgroundColor: '#fff1dc', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: 'bold' },
  attentionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fffaf1', borderWidth: 1, borderColor: '#f3dfbb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  attentionCopy: { flex: 1, minWidth: 0 },
  attentionName: { color: '#6e4b15', fontSize: 12, fontWeight: 'bold' },
  attentionDate: { color: '#a96a13', fontSize: 11, marginTop: 2 },
  attentionArrow: { color: '#b8791e', fontSize: 22, marginLeft: 8 },
  attentionEmpty: { color: '#6a7d8d', fontSize: 12, marginTop: 9 },
  loader: { marginTop: 30 },
  errorCard: { backgroundColor: '#fff4f3', borderWidth: 1, borderColor: '#f2c6c2', borderRadius: 16, alignItems: 'center', padding: 24 },
  errorText: { color: '#a33a33', fontWeight: '600', textAlign: 'center' },
  retryButton: { borderWidth: 1, borderColor: '#a33a33', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9, marginTop: 14 },
  retryText: { color: '#a33a33', fontWeight: 'bold' },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 17, alignItems: 'center', padding: 30 },
  emptyIcon: { color: '#00A8A8', fontSize: 34 },
  emptyTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  emptyText: { color: '#6a7d8d', textAlign: 'center', marginTop: 6, marginBottom: 15 },
  secondaryButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { flexGrow: 1, flexShrink: 1, flexBasis: 330, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 17, padding: 17 },
  retiredCard: { opacity: 0.63 },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  categoryLabel: { color: '#0077CC', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#e6f7f3' },
  dueBadge: { backgroundColor: '#fff1dc' },
  retiredBadge: { backgroundColor: '#edf0f2' },
  statusText: { color: '#008d78', fontSize: 10, fontWeight: 'bold' },
  itemName: { color: '#164c67', fontSize: 20, fontWeight: 'bold', marginTop: 13 },
  itemBrand: { color: '#6a7d8d', fontSize: 13, marginTop: 5 },
  serviceDate: { color: '#7a8e9c', fontSize: 12, marginTop: 15 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e7eef3' },
  packButton: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  packButtonActive: { backgroundColor: '#e6f7f3', borderColor: '#55c6ad' },
  packText: { color: '#0077CC', fontSize: 11, fontWeight: 'bold' },
  packTextActive: { color: '#008d78' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  actionText: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' },
  deleteText: { color: '#b34b44', fontSize: 12, fontWeight: 'bold' },
});
