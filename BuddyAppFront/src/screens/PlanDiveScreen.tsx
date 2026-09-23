import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import API from '../api/api';
import { COUNTRIES } from './CreateDiveScreen';

type ChecklistItem = {
  id: string;
  label: string;
  group: string;
};

const CHECKLIST: ChecklistItem[] = [
  { id: 'mask', label: 'Mask and spare mask', group: 'Personal gear' },
  { id: 'fins', label: 'Fins and boots', group: 'Personal gear' },
  { id: 'computer', label: 'Dive computer charged', group: 'Personal gear' },
  { id: 'buoyancy', label: 'BCD inflator tested', group: 'Personal gear' },
  { id: 'regulator', label: 'Regulator and alternate air source', group: 'Gas and equipment' },
  { id: 'tank', label: 'Tank visual inspection complete', group: 'Gas and equipment' },
  { id: 'weights', label: 'Weights and quick-release checked', group: 'Gas and equipment' },
  { id: 'surface', label: 'Surface marker and whistle packed', group: 'Safety' },
  { id: 'first-aid', label: 'First aid kit and emergency contacts', group: 'Safety' },
];

const CONDITIONS = ['Calm', 'Good', 'Choppy', 'Low visibility'];
const GAS_OPTIONS = ['Air', 'Nitrox 32', 'Nitrox 36', 'Trimix'];

export default function PlanDiveScreen({ navigation }: any) {
  const [country, setCountry] = useState('');
  const [site, setSite] = useState('');
  const [date, setDate] = useState('');
  const [depth, setDepth] = useState('25');
  const [duration, setDuration] = useState('45');
  const [buddy, setBuddy] = useState('');
  const [condition, setCondition] = useState('Good');
  const [gas, setGas] = useState('Air');
  const [shoreEntry, setShoreEntry] = useState(true);
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const completed = useMemo(() => CHECKLIST.filter((item) => checked[item.id]).length, [checked]);
  const groupedChecklist = useMemo(() => {
    return CHECKLIST.reduce<Record<string, ChecklistItem[]>>((groups, item) => {
      groups[item.group] = [...(groups[item.group] || []), item];
      return groups;
    }, {});
  }, []);

  const toggleItem = (id: string) => {
    setChecked((current) => ({ ...current, [id]: !current[id] }));
    setSaved(false);
  };

  const savePlan = async () => {
    setSaveError('');
    const trimmedCountry = country.trim();
    const trimmedSite = site.trim();
    const trimmedDate = date.trim();

    if (!trimmedCountry) {
      setSaveError('Please select a country.');
      return;
    }
    if (!trimmedSite) {
      setSaveError('Please enter a dive site name.');
      return;
    }
    if (!trimmedDate) {
      setSaveError('Please enter a planned date (DD/MM/YYYY).');
      return;
    }

    const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedDate);
    const isoDateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmedDate);
    const day = dateMatch ? Number(dateMatch[1]) : isoDateMatch ? Number(isoDateMatch[3]) : 0;
    const month = dateMatch ? Number(dateMatch[2]) : isoDateMatch ? Number(isoDateMatch[2]) : 0;
    const year = dateMatch ? Number(dateMatch[3]) : isoDateMatch ? Number(isoDateMatch[1]) : 0;
    const parsedDate = day && month && year
      ? new Date(year, month - 1, day, 12, 0, 0)
      : null;

    if (!dateMatch && !isoDateMatch) {
      setSaveError('Enter a valid date in DD/MM/YYYY format.');
      return;
    }
    if (!parsedDate || Number.isNaN(parsedDate.getTime())
      || parsedDate.getDate() !== day || parsedDate.getMonth() !== month - 1
      || parsedDate.getFullYear() !== year) {
      setSaveError('The date entered is not a valid calendar date.');
      return;
    }

    const maxDepth = Number(depth);
    const plannedDuration = Number(duration);
    if (!Number.isFinite(maxDepth) || maxDepth < 1) {
      setSaveError('Max depth must be a positive number in meters.');
      return;
    }
    if (!Number.isInteger(plannedDuration) || plannedDuration < 1) {
      setSaveError('Duration must be a positive whole number of minutes.');
      return;
    }

    setSaving(true);
    try {
      await API.post('/planned-dives', {
        date: parsedDate.toISOString(),
        country: trimmedCountry,
        location: trimmedSite,
        maxDepth,
        duration: plannedDuration,
        buddy: buddy.trim() || 'Solo diver',
        condition,
        gas,
        shoreEntry,
        notes: notes.trim() || undefined,
        checklist: checked,
      });
      setSaved(true);
      navigation.navigate('PlannedDives');
    } catch (error: any) {
      const message = error?.response?.data?.message;
      const readableMessage = Array.isArray(message) ? message[0] : message || 'Could not save this plan. Please try again.';
      setSaveError(readableMessage);
      Alert.alert('Could not save plan', readableMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>PRE-DIVE PLANNER</Text>
            <Text style={styles.title}>Plan your next dive</Text>
            <Text style={styles.subtitle}>Prepare the details and equipment before you enter the water.</Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressValue}>{completed}/{CHECKLIST.length}</Text>
            <Text style={styles.progressLabel}>ready</Text>
          </View>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Dive details</Text>
            <Text style={styles.label}>Country</Text>
            <View style={styles.pickerWrap}>
              <Picker
                accessibilityLabel="Planned dive country"
                selectedValue={country}
                onValueChange={setCountry}
                style={styles.picker}
              >
                <Picker.Item label="Select a country" value="" />
                {COUNTRIES.map((option) => <Picker.Item key={option} label={option} value={option} />)}
              </Picker>
            </View>
            <Text style={styles.label}>Dive site</Text>
            <TextInput
              accessibilityLabel="Dive site"
              placeholder="Cala de la Mar"
              placeholderTextColor="#7890a0"
              value={site}
              onChangeText={setSite}
              style={styles.input}
            />
            <View style={styles.twoFields}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  accessibilityLabel="Planned date"
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#7890a0"
                  value={date}
                  onChangeText={setDate}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Buddy</Text>
                <TextInput
                  accessibilityLabel="Buddy name"
                  placeholder="Add a buddy"
                  placeholderTextColor="#7890a0"
                  value={buddy}
                  onChangeText={setBuddy}
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.twoFields}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Max depth (m)</Text>
                <TextInput
                  accessibilityLabel="Planned maximum depth"
                  keyboardType="number-pad"
                  value={depth}
                  onChangeText={setDepth}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput
                  accessibilityLabel="Planned duration"
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.label}>Expected conditions</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: condition === option }}
                  onPress={() => setCondition(option)}
                  style={[styles.chip, condition === option && styles.chipActive]}
                >
                  <Text style={[styles.chipText, condition === option && styles.chipTextActive]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Equipment setup</Text>
            <Text style={styles.label}>Gas mix</Text>
            <View style={styles.gasRow}>
              {GAS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: gas === option }}
                  onPress={() => setGas(option)}
                  style={[styles.gasOption, gas === option && styles.gasOptionActive]}
                >
                  <Text style={[styles.gasText, gas === option && styles.gasTextActive]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Shore entry</Text>
                <Text style={styles.toggleHint}>Start and finish from the same entry point</Text>
              </View>
              <Switch
                accessibilityLabel="Shore entry"
                value={shoreEntry}
                onValueChange={setShoreEntry}
                trackColor={{ false: '#cbd5e1', true: '#8ed6d1' }}
                thumbColor={shoreEntry ? '#00A8A8' : '#f8fafc'}
              />
            </View>
            <View style={styles.noticeRow}>
              <Text style={styles.noticeIcon}>!</Text>
              <Text style={styles.noticeText}>Confirm the local tide, exit route and emergency contact before departure.</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.checklistHeading}>
            <View>
              <Text style={styles.panelTitle}>Equipment checklist</Text>
              <Text style={styles.panelSubtitle}>Mark each item before you leave the dock.</Text>
            </View>
            <Text style={styles.checklistCount}>{completed} of {CHECKLIST.length}</Text>
          </View>
          <View style={styles.checklistGroups}>
            {Object.entries(groupedChecklist).map(([group, items]) => (
              <View key={group} style={styles.checklistGroup}>
                <Text style={styles.groupLabel}>{group}</Text>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!checked[item.id] }}
                    onPress={() => toggleItem(item.id)}
                    style={[styles.checkItem, checked[item.id] && styles.checkItemActive]}
                  >
                    <View style={[styles.checkbox, checked[item.id] && styles.checkboxActive]}>
                      {checked[item.id] ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Plan notes</Text>
          <TextInput
            accessibilityLabel="Plan notes"
            multiline
            placeholder="Add a route, meeting point or safety note"
            placeholderTextColor="#7890a0"
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.notesInput]}
          />
        </View>
      </ScrollView>

      <View style={styles.saveBar}>
        <View style={styles.saveCopy}>
          <Text style={styles.saveTitle}>{saved ? 'Plan saved' : 'Ready to plan?'}</Text>
          <Text style={saveError ? styles.saveErrorText : styles.saveHint}>{saveError || (saved ? 'Opening your planned dives.' : `${completed}/${CHECKLIST.length} equipment checks complete`)}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={savePlan} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save plan'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('CreateDive')} style={styles.logButton}>
          <Text style={styles.logButtonText}>Log dive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 28 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderRadius: 22, padding: 24, marginBottom: 18, borderWidth: 1, borderColor: '#c5e9f3', gap: 16 },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 280 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 7 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, marginTop: 7, lineHeight: 21 },
  progressBadge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#00A8A8' },
  progressValue: { color: '#0077CC', fontWeight: 'bold', fontSize: 22 },
  progressLabel: { color: '#587080', fontSize: 12, marginTop: 2 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 18 },
  panel: { flexGrow: 1, flexShrink: 1, flexBasis: 340, width: '100%', maxWidth: '100%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe6ee', padding: 20, marginBottom: 18 },
  panelTitle: { color: '#1e293b', fontSize: 19, fontWeight: 'bold', marginBottom: 5 },
  panelSubtitle: { color: '#6b7c8d', fontSize: 13, marginBottom: 16 },
  label: { color: '#334155', fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 7 },
  input: { width: '100%', minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 11, color: '#1e293b', fontSize: 15 },
  pickerWrap: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  picker: { height: 48, color: '#1e293b' },
  twoFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fieldHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 140 },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 90, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff', alignItems: 'center' },
  chipActive: { backgroundColor: '#e7f6fb', borderColor: '#0077CC' },
  chipText: { color: '#0077CC', fontSize: 13, fontWeight: 'bold' },
  chipTextActive: { color: '#0077CC' },
  gasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gasOption: { flexGrow: 1, flexBasis: 90, borderRadius: 13, borderWidth: 1, borderColor: '#c9e4f4', padding: 11, alignItems: 'center', backgroundColor: '#f7fbff' },
  gasOptionActive: { backgroundColor: '#e2f7f5', borderColor: '#00A8A8' },
  gasText: { color: '#3c5b70', fontSize: 13, fontWeight: 'bold' },
  gasTextActive: { color: '#008d8d' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, paddingVertical: 3 },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { color: '#334155', fontWeight: 'bold', fontSize: 15 },
  toggleHint: { color: '#728396', fontSize: 12, marginTop: 3 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: '#fff6dc', padding: 12, marginTop: 18, gap: 9 },
  noticeIcon: { width: 22, height: 22, lineHeight: 22, textAlign: 'center', borderRadius: 11, backgroundColor: '#f4b942', color: '#fff', fontWeight: 'bold' },
  noticeText: { color: '#795d20', fontSize: 12, flex: 1, lineHeight: 17 },
  checklistHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  checklistCount: { color: '#00A8A8', fontWeight: 'bold', marginTop: 3 },
  checklistGroups: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  checklistGroup: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 240 },
  groupLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 9 },
  checkItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fbfd', borderRadius: 14, borderWidth: 1, borderColor: '#e0edf4', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 },
  checkItemActive: { backgroundColor: '#edfbf9', borderColor: '#91ddd5' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  checkLabel: { color: '#334155', flex: 1, fontSize: 13, lineHeight: 18 },
  notesInput: { minHeight: 100, width: '100%', textAlignVertical: 'top' },
  saveBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dbe6ee' },
  saveCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  saveTitle: { color: '#1e293b', fontWeight: 'bold', fontSize: 14 },
  saveHint: { color: '#728396', fontSize: 12, marginTop: 3 },
  saveErrorText: { color: '#a43b3b', fontSize: 12, marginTop: 3, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, minWidth: 130, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  logButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, minWidth: 110, alignItems: 'center' },
  logButtonText: { color: '#008d8d', fontWeight: 'bold' },
});
