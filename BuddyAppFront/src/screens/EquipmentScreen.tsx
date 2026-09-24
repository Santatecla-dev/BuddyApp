import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Equipment, EquipmentCondition } from '../types';

const CATEGORIES = ['Regulator', 'BCD', 'Exposure', 'Computer', 'Camera', 'Accessories'];
const CONDITIONS: EquipmentCondition[] = ['good', 'service_due', 'retired'];
const CONDITION_LABELS: Record<EquipmentCondition, string> = { good: 'Ready', service_due: 'Service due', retired: 'Retired' };

type FormState = {
  name: string;
  category: string;
  brand: string;
  model: string;
  nextServiceDate: string;
  condition: EquipmentCondition;
  notes: string;
};

const EMPTY_FORM: FormState = { name: '', category: CATEGORIES[0], brand: '', model: '', nextServiceDate: '', condition: 'good', notes: '' };

const isDueSoon = (item: Equipment) => {
  if (!item.nextServiceDate) return item.condition === 'service_due';
  const next = new Date(item.nextServiceDate).getTime();
  return item.condition === 'service_due' || (!Number.isNaN(next) && next <= Date.now() + 30 * 86400000);
};

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
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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
      return matchesQuery && (category === 'all' || item.category === category) && (condition === 'all' || item.condition === condition);
    });
  }, [category, condition, items, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (item: Equipment) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, brand: item.brand || '', model: item.model || '', nextServiceDate: item.nextServiceDate ? item.nextServiceDate.slice(0, 10) : '', condition: item.condition, notes: item.notes || '' });
    setFormError('');
    setModalVisible(true);
  };

  const saveEquipment = async () => {
    if (!form.name.trim()) {
      setFormError('Give this equipment a name.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, name: form.name.trim(), brand: form.brand.trim() || undefined, model: form.model.trim() || undefined, nextServiceDate: form.nextServiceDate.trim() || undefined, notes: form.notes.trim() || undefined };
      if (editing) await API.patch(`/equipment/${editing.id}`, payload);
      else await API.post('/equipment', payload);
      setModalVisible(false);
      await loadEquipment();
    } catch {
      setFormError('We could not save this equipment.');
    } finally {
      setSaving(false);
    }
  };

  const togglePacked = async (item: Equipment) => {
    try {
      await API.patch(`/equipment/${item.id}`, { packed: !item.packed });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, packed: !candidate.packed } : candidate));
    } catch {
      setError('Could not update the packing status.');
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroCopy}><Text style={styles.eyebrow}>DIVE KIT</Text><Text style={styles.title}>My equipment</Text><Text style={styles.subtitle}>Keep your gear, maintenance dates and packing status in one place.</Text></View>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={openCreate}><Text style={styles.primaryButtonText}>+ Add equipment</Text></TouchableOpacity>
        </View>

        <View style={styles.summaryRow}><View style={styles.summaryCard}><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>Total items</Text></View><View style={styles.summaryCard}><Text style={styles.summaryValue}>{dueCount}</Text><Text style={styles.summaryLabel}>Need attention</Text></View><View style={styles.summaryCard}><Text style={styles.summaryValue}>{packedCount}/{items.length || 0}</Text><Text style={styles.summaryLabel}>Packed</Text></View></View>

        <View style={styles.toolbar}><TextInput accessibilityLabel="Search equipment" value={query} onChangeText={setQuery} placeholder="Search gear, brand or model" placeholderTextColor="#7890a0" style={styles.searchInput} /><View style={styles.chipRow}><TouchableOpacity accessibilityRole="button" onPress={() => setCategory('all')} style={[styles.chip, category === 'all' && styles.chipActive]}><Text style={[styles.chipText, category === 'all' && styles.chipTextActive]}>All</Text></TouchableOpacity>{CATEGORIES.slice(0, 4).map((value) => <TouchableOpacity accessibilityRole="button" key={value} onPress={() => setCategory(value)} style={[styles.chip, category === value && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, category === value && styles.chipTextActive]}>{value}</Text></TouchableOpacity>)}</View><View style={styles.conditionRow}>{(['all', ...CONDITIONS] as const).map((value) => <TouchableOpacity accessibilityRole="button" key={value} onPress={() => setCondition(value)} style={[styles.conditionChip, condition === value && styles.conditionChipActive]}><Text style={[styles.conditionText, condition === value && styles.conditionTextActive]}>{value === 'all' ? 'Any status' : CONDITION_LABELS[value]}</Text></TouchableOpacity>)}</View></View>

        {loading ? <ActivityIndicator accessibilityLabel="Loading equipment" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={loadEquipment}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
        {!loading && !error && visibleItems.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>◌</Text><Text style={styles.emptyTitle}>{items.length ? 'No equipment matches' : 'Your kit is empty'}</Text><Text style={styles.emptyText}>{items.length ? 'Try another search or filter.' : 'Add your first piece of dive gear to get started.'}</Text>{!items.length ? <TouchableOpacity style={styles.secondaryButton} onPress={openCreate}><Text style={styles.secondaryButtonText}>Add first item</Text></TouchableOpacity> : null}</View> : null}

        <View style={styles.grid}>{visibleItems.map((item) => <View key={item.id} style={[styles.card, item.condition === 'retired' && styles.retiredCard]}>
          <View style={styles.cardTop}><Text style={styles.categoryLabel}>{item.category}</Text><View style={[styles.statusBadge, item.condition === 'service_due' && styles.dueBadge, item.condition === 'retired' && styles.retiredBadge]}><Text style={styles.statusText}>{CONDITION_LABELS[item.condition]}</Text></View></View>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemBrand}>{[item.brand, item.model].filter(Boolean).join(' ') || 'Brand and model not specified'}</Text>
          <Text style={styles.serviceDate}>{formatServiceDate(item.nextServiceDate)}</Text>
          <View style={styles.cardFooter}><TouchableOpacity accessibilityRole="button" accessibilityState={{ checked: item.packed }} onPress={() => togglePacked(item)} style={[styles.packButton, item.packed && styles.packButtonActive]}><Text style={[styles.packText, item.packed && styles.packTextActive]}>{item.packed ? '✓ Packed' : 'Mark packed'}</Text></TouchableOpacity><View style={styles.cardActions}><TouchableOpacity accessibilityLabel={`Open details for ${item.name}`} onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: item.id })}><Text style={styles.actionText}>Details</Text></TouchableOpacity><TouchableOpacity accessibilityLabel={`Edit ${item.name}`} onPress={() => openEdit(item)}><Text style={styles.actionText}>Edit</Text></TouchableOpacity><TouchableOpacity accessibilityLabel={`Remove ${item.name}`} onPress={() => removeEquipment(item)}><Text style={styles.deleteText}>Remove</Text></TouchableOpacity></View></View>
        </View>)}</View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><ScrollView keyboardShouldPersistTaps="handled"><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing ? 'Edit equipment' : 'Add equipment'}</Text><TouchableOpacity accessibilityLabel="Close equipment form" onPress={() => setModalVisible(false)}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
          <Text style={styles.fieldLabel}>Name *</Text><TextInput accessibilityLabel="Equipment name" value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Travel BCD" style={styles.input} />
          <Text style={styles.fieldLabel}>Category</Text><View style={styles.modalChipRow}>{CATEGORIES.map((value) => <TouchableOpacity key={value} onPress={() => setForm((current) => ({ ...current, category: value }))} style={[styles.modalChip, form.category === value && styles.modalChipActive]}><Text style={[styles.modalChipText, form.category === value && styles.modalChipTextActive]}>{value}</Text></TouchableOpacity>)}</View>
          <View style={styles.formRow}><View style={styles.formHalf}><Text style={styles.fieldLabel}>Brand</Text><TextInput accessibilityLabel="Equipment brand" value={form.brand} onChangeText={(value) => setForm((current) => ({ ...current, brand: value }))} placeholder="Apeks" style={styles.input} /></View><View style={styles.formHalf}><Text style={styles.fieldLabel}>Model</Text><TextInput accessibilityLabel="Equipment model" value={form.model} onChangeText={(value) => setForm((current) => ({ ...current, model: value }))} placeholder="XTX50" style={styles.input} /></View></View>
          <Text style={styles.fieldLabel}>Next service date</Text><TextInput accessibilityLabel="Next service date" value={form.nextServiceDate} onChangeText={(value) => setForm((current) => ({ ...current, nextServiceDate: value }))} placeholder="YYYY-MM-DD" style={styles.input} />
          <Text style={styles.fieldLabel}>Condition</Text><View style={styles.modalChipRow}>{CONDITIONS.map((value) => <TouchableOpacity key={value} onPress={() => setForm((current) => ({ ...current, condition: value }))} style={[styles.modalChip, form.condition === value && styles.modalChipActive]}><Text style={[styles.modalChipText, form.condition === value && styles.modalChipTextActive]}>{CONDITION_LABELS[value]}</Text></TouchableOpacity>)}</View>
          <Text style={styles.fieldLabel}>Notes</Text><TextInput accessibilityLabel="Equipment notes" value={form.notes} onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))} placeholder="Service centre, fit notes..." multiline style={[styles.input, styles.notesInput]} />
          {formError ? <Text accessibilityRole="alert" style={styles.formError}>{formError}</Text> : null}
          <View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={saving} style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveEquipment}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add equipment'}</Text></TouchableOpacity></View>
        </ScrollView></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 24, marginBottom: 18 },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#425466', fontSize: 15, lineHeight: 21, marginTop: 7 },
  primaryButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryCard: { flex: 1, minWidth: 140, padding: 15, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee' },
  summaryValue: { color: '#0077CC', fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { color: '#6a7d8d', fontSize: 12, marginTop: 4 },
  toolbar: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 14, marginBottom: 18 },
  searchInput: { minHeight: 46, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 12, paddingHorizontal: 13, color: '#334155', fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 17, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 130 },
  chipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  chipText: { color: '#0077CC', fontWeight: 'bold', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  conditionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  conditionChip: { borderBottomWidth: 2, borderBottomColor: '#dbe6ee', paddingHorizontal: 5, paddingVertical: 7 },
  conditionChipActive: { borderBottomColor: '#00A8A8' },
  conditionText: { color: '#7890a0', fontSize: 12 },
  conditionTextActive: { color: '#008d8d', fontWeight: 'bold' },
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
  card: { flexGrow: 1, flexBasis: 330, minWidth: 280, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 17, padding: 17, shadowColor: '#164c67', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  retiredCard: { opacity: 0.63 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryLabel: { color: '#0077CC', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#e6f7f3' },
  dueBadge: { backgroundColor: '#fff1dc' },
  retiredBadge: { backgroundColor: '#edf0f2' },
  statusText: { color: '#008d78', fontSize: 10, fontWeight: 'bold' },
  itemName: { color: '#164c67', fontSize: 20, fontWeight: 'bold', marginTop: 13 },
  itemBrand: { color: '#6a7d8d', fontSize: 13, marginTop: 5 },
  serviceDate: { color: '#7a8e9c', fontSize: 12, marginTop: 15 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e7eef3' },
  packButton: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  packButtonActive: { backgroundColor: '#e6f7f3', borderColor: '#55c6ad' },
  packText: { color: '#0077CC', fontSize: 11, fontWeight: 'bold' },
  packTextActive: { color: '#008d78' },
  cardActions: { flexDirection: 'row', gap: 10 },
  actionText: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' },
  deleteText: { color: '#b34b44', fontSize: 12, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8, 34, 48, 0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 620, maxHeight: '92%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalTitle: { color: '#164c67', fontSize: 22, fontWeight: 'bold' },
  closeText: { color: '#6e8794', fontSize: 27, lineHeight: 23, paddingHorizontal: 4 },
  fieldLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', marginTop: 13, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', backgroundColor: '#fff', fontSize: 14 },
  modalChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  modalChip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 },
  modalChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  modalChipText: { color: '#0077CC', fontSize: 12 },
  modalChipTextActive: { color: '#fff', fontWeight: 'bold' },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  formError: { color: '#b34b44', marginTop: 12, textAlign: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  cancelText: { color: '#637789', fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
});
