import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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


export const isValidEquipmentDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export default function EquipmentForm({ editing, onClose, onSaved }: {
  editing: Equipment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const modalVisible = true;
  const [form, setForm] = useState<FormState>(() => editing ? {
    name: editing.name, category: editing.category, brand: editing.brand || '', model: editing.model || '',
    nextServiceDate: editing.nextServiceDate?.slice(0, 10) || '', condition: editing.condition, notes: editing.notes || '',
  } : { ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const close = () => { if (!savingRef.current) onClose(); };
  const saveEquipment = async () => {
    if (savingRef.current) return;
    if (!form.name.trim()) {
      setFormError('Give this equipment a name.');
      return;
    }
    if (form.nextServiceDate.trim() && !isValidEquipmentDate(form.nextServiceDate.trim())) {
      setFormError('Enter a valid service date as YYYY-MM-DD.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, name: form.name.trim(), brand: form.brand.trim() || null, model: form.model.trim() || null, nextServiceDate: form.nextServiceDate.trim() || null, notes: form.notes.trim() || null };
      if (editing) await API.patch(`/equipment/${editing.id}`, payload);
      else await API.post('/equipment', payload);
      onSaved();
      onClose();
    } catch {
      setFormError('We could not save this equipment.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };


  return (
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => close()}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><ScrollView keyboardShouldPersistTaps="handled"><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing ? 'Edit equipment' : 'Add equipment'}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close equipment form" onPress={() => close()}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
          <Text style={styles.fieldLabel}>Name *</Text><TextInput accessibilityLabel="Equipment name" value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Travel BCD" style={styles.input} />
          <Text style={styles.fieldLabel}>Category</Text><View style={styles.modalChipRow}>{CATEGORIES.map((value) => <TouchableOpacity accessibilityRole="radio" aria-checked={form.category === value} accessibilityState={{ checked: form.category === value }} key={value} onPress={() => setForm((current) => ({ ...current, category: value }))} style={[styles.modalChip, form.category === value && styles.modalChipActive]}><Text style={[styles.modalChipText, form.category === value && styles.modalChipTextActive]}>{value}</Text></TouchableOpacity>)}</View>
          <View style={styles.formRow}><View style={styles.formHalf}><Text style={styles.fieldLabel}>Brand</Text><TextInput accessibilityLabel="Equipment brand" value={form.brand} onChangeText={(value) => setForm((current) => ({ ...current, brand: value }))} placeholder="Apeks" style={styles.input} /></View><View style={styles.formHalf}><Text style={styles.fieldLabel}>Model</Text><TextInput accessibilityLabel="Equipment model" value={form.model} onChangeText={(value) => setForm((current) => ({ ...current, model: value }))} placeholder="XTX50" style={styles.input} /></View></View>
          <Text style={styles.fieldLabel}>Next service date</Text><TextInput accessibilityLabel="Next service date" value={form.nextServiceDate} onChangeText={(value) => setForm((current) => ({ ...current, nextServiceDate: value }))} placeholder="YYYY-MM-DD" style={styles.input} />
          <Text style={styles.fieldLabel}>Condition</Text><View style={styles.modalChipRow}>{CONDITIONS.map((value) => <TouchableOpacity accessibilityRole="radio" aria-checked={form.condition === value} accessibilityState={{ checked: form.condition === value }} key={value} onPress={() => setForm((current) => ({ ...current, condition: value }))} style={[styles.modalChip, form.condition === value && styles.modalChipActive]}><Text style={[styles.modalChipText, form.condition === value && styles.modalChipTextActive]}>{CONDITION_LABELS[value]}</Text></TouchableOpacity>)}</View>
          <Text style={styles.fieldLabel}>Notes</Text><TextInput accessibilityLabel="Equipment notes" value={form.notes} onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))} placeholder="Service centre, fit notes..." multiline style={[styles.input, styles.notesInput]} />
          {formError ? <Text accessibilityRole="alert" style={styles.formError}>{formError}</Text> : null}
          <View style={styles.modalActions}><TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={() => close()}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving} style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveEquipment}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add equipment'}</Text></TouchableOpacity></View>
        </ScrollView></View></View>
      </Modal>
  );
}
const styles = StyleSheet.create({
  primaryButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8, 34, 48, 0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 620, maxHeight: '92%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  modalTitle: { flex: 1, color: '#164c67', fontSize: 22, fontWeight: 'bold' },
  closeText: { color: '#6e8794', fontSize: 27, lineHeight: 23, paddingHorizontal: 4 },
  fieldLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', marginTop: 13, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', backgroundColor: '#fff', fontSize: 14 },
  modalChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  modalChip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 10 },
  modalChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  modalChipText: { color: '#0077CC', fontSize: 12 },
  modalChipTextActive: { color: '#fff', fontWeight: 'bold' },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  formHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  formError: { color: '#b34b44', marginTop: 12, textAlign: 'center' },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  cancelText: { color: '#637789', fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
});
