import React, { useMemo, useRef, useState } from 'react';
import {
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

import { CHECKLIST, ChecklistItem } from '../utils/plannedDiveChecklist';
import CenterSearchField from '../components/CenterSearchField';

const CONDITIONS = ['Calm', 'Good', 'Choppy', 'Low visibility'];
const GAS_OPTIONS = ['Air', 'Nitrox 32', 'Nitrox 36', 'Trimix'];

export default function PlanDiveScreen({ navigation, route }: any) {
  const isCenterMode = route?.params?.centerMode === true;
  const styles = isCenterMode ? { ...buddyStyles, ...centerStyles } : buddyStyles;
  const scrollRef = useRef<ScrollView>(null);
  const [country, setCountry] = useState('');
  const [site, setSite] = useState('');
  const [centerId, setCenterId] = useState('');
  const [buddyUserIds, setBuddyUserIds] = useState('');
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    if (saving) return;
    setSaveError('');
    const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
    const isoDateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
    const day = dateMatch ? Number(dateMatch[1]) : isoDateMatch ? Number(isoDateMatch[3]) : 0;
    const month = dateMatch ? Number(dateMatch[2]) : isoDateMatch ? Number(isoDateMatch[2]) : 0;
    const year = dateMatch ? Number(dateMatch[3]) : isoDateMatch ? Number(isoDateMatch[1]) : 0;
    const parsedDate = day && month && year
      ? new Date(year, month - 1, day, 12, 0, 0)
      : null;
    const errors: Record<string, string> = {};
    if (!country) errors.country = 'Select a country.';
    if (!site.trim()) errors.site = 'Enter a dive site.';
    if ((!dateMatch && !isoDateMatch) || !parsedDate || Number.isNaN(parsedDate.getTime())
      || parsedDate.getDate() !== day || parsedDate.getMonth() !== month - 1
      || parsedDate.getFullYear() !== year) {
      errors.date = 'Enter a real calendar date in DD/MM/YYYY format (for example, 25/09/2026).';
    }
    const maxDepth = Number(depth);
    const plannedDuration = Number(duration);
    if (!Number.isFinite(maxDepth) || maxDepth < 1 || maxDepth > 130) errors.depth = 'Enter a depth from 1 to 130 m.';
    if (!Number.isInteger(plannedDuration) || plannedDuration < 1 || plannedDuration > 1440) errors.duration = 'Enter a whole-number duration from 1 to 1440 minutes.';
    setFieldErrors(errors);
    if (Object.keys(errors).length || !parsedDate) {
      setSaveError('Please correct the highlighted fields before saving.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSaving(true);
    try {
      const endpoint = isCenterMode ? '/planned-dives/center' : '/planned-dives';
      await API.post(endpoint, {
        date: parsedDate.toISOString(),
        country,
        location: site.trim(),
        maxDepth,
        duration: plannedDuration,
        buddy: buddy.trim() || 'Solo diver',
        condition,
        gas,
        shoreEntry,
        notes: notes.trim() || undefined,
        checklist: Object.fromEntries(CHECKLIST.map(item => [item.id, !!checked[item.id]])),
        centerId: centerId ? Number(centerId) : undefined,
        buddyUserIds: isCenterMode ? buddyUserIds.split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0) : undefined,
      });
      setSaved(true);
      navigation.navigate('PlannedDives');
    } catch (error: any) {
      const message = error?.response?.data?.message;
      const readableMessage = Array.isArray(message) ? message.join(' ') : message || 'Could not save this plan. Please try again.';
      setSaveError(readableMessage);

    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
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

        {Object.keys(fieldErrors).length > 0 && <Text accessibilityRole="alert" style={styles.saveErrorText}>Please correct the fields marked below.</Text>}
        <View style={styles.formGrid}>
          <View style={[styles.panel, styles.formPanel]}>
            <Text style={styles.panelTitle}>Dive details</Text>
            <Text style={styles.label}>Country</Text>
            <View style={[styles.pickerWrap, !!fieldErrors.country && styles.invalidInput]}>
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
            {fieldErrors.country && <Text style={styles.saveErrorText}>{fieldErrors.country}</Text>}
            <Text style={styles.label}>Dive site</Text>
            <TextInput
              accessibilityLabel="Dive site"
              placeholder="Cala de la Mar"
              value={site}
              onChangeText={setSite}
              style={[styles.input, !!fieldErrors.site && styles.invalidInput]}
            />
            {fieldErrors.site && <Text style={styles.saveErrorText}>{fieldErrors.site}</Text>}
            {!isCenterMode ? <CenterSearchField selectedCenterId={centerId} onSelect={(center) => setCenterId(center ? String(center.id) : '')} label="Dive center (optional)" /> : null}
            <View style={styles.twoFields}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  accessibilityLabel="Planned date"
                  placeholder="DD/MM/YYYY"
                  value={date}
                  onChangeText={setDate}
                  style={[styles.input, !!fieldErrors.date && styles.invalidInput]}
                />
                {fieldErrors.date && <Text style={styles.saveErrorText}>{fieldErrors.date}</Text>}
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Buddy</Text>
                <TextInput
                  accessibilityLabel="Buddy name"
                  placeholder="Add a buddy"
                  value={buddy}
                  onChangeText={setBuddy}
                  style={styles.input}
                />
              </View>
            </View>
            {isCenterMode ? <><Text style={styles.label}>Buddy user IDs</Text><TextInput accessibilityLabel="Buddy user IDs" placeholder="12, 24, 31" value={buddyUserIds} onChangeText={setBuddyUserIds} style={styles.input} /><Text style={styles.hint}>Each diver receives an invitation to this center-planned dive.</Text></> : null}
            <View style={styles.twoFields}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Max depth (m)</Text>
                <TextInput
                  accessibilityLabel="Planned maximum depth"
                  keyboardType="number-pad"
                  value={depth}
                  onChangeText={setDepth}
                  style={[styles.input, !!fieldErrors.depth && styles.invalidInput]}
                />
                {fieldErrors.depth && <Text style={styles.saveErrorText}>{fieldErrors.depth}</Text>}
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput
                  accessibilityLabel="Planned duration"
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  style={[styles.input, !!fieldErrors.duration && styles.invalidInput]}
                />
                {fieldErrors.duration && <Text style={styles.saveErrorText}>{fieldErrors.duration}</Text>}
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

          <View style={[styles.panel, styles.formPanel]}>
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
                trackColor={{ false: '#cbd5e1', true: isCenterMode ? '#789aa6' : '#8ed6d1' }}
                thumbColor={shoreEntry ? (isCenterMode ? '#123b52' : '#00A8A8') : '#f8fafc'}
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
            <View style={styles.checklistCopy}>
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
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.notesInput]}
          />
        </View>


      <View style={styles.saveBar}>
        <View style={styles.saveCopy}>
          <Text style={styles.saveTitle}>{saved ? 'Plan saved' : 'Ready to plan?'}</Text>
          <Text accessibilityRole={saveError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={saveError ? styles.saveErrorText : styles.saveHint}>{saveError || (saved ? 'Opening your planned dives.' : `${completed}/${CHECKLIST.length} equipment checks complete`)}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={savePlan} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save plan'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('CreateDive')} style={styles.logButton}>
          <Text style={styles.logButtonText}>Log dive</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

const buddyStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc', overflow: 'hidden' },
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 28 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderRadius: 22, padding: 24, marginBottom: 18, borderWidth: 1, borderColor: '#c5e9f3' },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 7 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, marginTop: 7, lineHeight: 21 },
  progressBadge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#00A8A8' },
  progressValue: { color: '#0077CC', fontWeight: 'bold', fontSize: 22 },
  progressLabel: { color: '#587080', fontSize: 12, marginTop: 2 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 18 },
  formPanel: { flexGrow: 1, flexShrink: 1, flexBasis: 440, minWidth: 0 },
  panel: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe6ee', padding: 20, marginBottom: 18 },
  panelTitle: { color: '#1e293b', fontSize: 19, fontWeight: 'bold', marginBottom: 5 },
  panelSubtitle: { color: '#6b7c8d', fontSize: 13, marginBottom: 16 },
  label: { color: '#334155', fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 7 },
  hint: { color: '#718394', fontSize: 11, marginTop: 5 },
  input: { width: '100%', minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 11, color: '#334155', fontSize: 15 },
  pickerWrap: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  picker: { height: 48, width: '100%', color: '#334155', backgroundColor: '#fff' },
  twoFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fieldHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  chipText: { color: '#0077CC', fontSize: 13, fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
  gasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gasOption: { minWidth: 92, borderRadius: 13, borderWidth: 1, borderColor: '#c9e4f4', padding: 11, alignItems: 'center', backgroundColor: '#f7fbff' },
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
  checklistHeading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  checklistCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0 },
  invalidInput: { borderColor: '#a43b3b', borderWidth: 2 },
  checklistCount: { color: '#00A8A8', fontWeight: 'bold', marginTop: 3 },
  checklistGroups: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  checklistGroup: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  groupLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 9 },
  checkItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fbfd', borderRadius: 14, borderWidth: 1, borderColor: '#e0edf4', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 },
  checkItemActive: { backgroundColor: '#edfbf9', borderColor: '#91ddd5' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  checkLabel: { color: '#334155', flex: 1, fontSize: 13 },
  notesInput: { minHeight: 120, textAlignVertical: 'top' },
  saveBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18 },
  saveCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
  saveTitle: { color: '#1e293b', fontWeight: 'bold', fontSize: 14 },
  saveHint: { color: '#728396', fontSize: 12, marginTop: 3 },
  saveErrorText: { color: '#a43b3b', fontSize: 12, marginTop: 3, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, minWidth: 145, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  logButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, minWidth: 120, alignItems: 'center' },
  logButtonText: { color: '#008d8d', fontWeight: 'bold' },
});

const centerStyles = StyleSheet.create({
  screen: { backgroundColor: '#f3f6f8' },
  hero: { backgroundColor: '#e1ebee', borderColor: '#b9cdd3' },
  eyebrow: { color: '#0b777b' },
  title: { color: '#123b52' },
  progressBadge: { borderColor: '#0b777b' },
  progressValue: { color: '#123b52' },
  panel: { borderColor: '#ccdbe0' },
  panelTitle: { color: '#123b52' },
  label: { color: '#123b52' },
  input: { borderColor: '#aabfc7' },
  pickerWrap: { borderColor: '#aabfc7' },
  chip: { borderColor: '#aabfc7' },
  chipActive: { backgroundColor: '#123b52', borderColor: '#123b52' },
  chipText: { color: '#123b52' },
  gasOption: { borderColor: '#c3d5da', backgroundColor: '#f5f8f9' },
  gasOptionActive: { backgroundColor: '#e4f2ee', borderColor: '#0b777b' },
  gasTextActive: { color: '#0b777b' },
  checklistCount: { color: '#0b777b' },
  groupLabel: { color: '#123b52' },
  checkItemActive: { backgroundColor: '#e4f2ee', borderColor: '#9bc9c1' },
  checkboxActive: { backgroundColor: '#123b52', borderColor: '#123b52' },
  saveBar: { borderColor: '#ccdbe0' },
  saveButton: { backgroundColor: '#123b52' },
  logButton: { borderColor: '#0b777b' },
  logButtonText: { color: '#0b777b' },
});
