import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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

  const savePlan = () => {
    setSaved(true);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, Platform.OS === 'web' && styles.webHero]}>
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

        <View style={[styles.formGrid, Platform.OS === 'web' && styles.webFormGrid]}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Dive details</Text>
            <Text style={styles.label}>Dive site</Text>
            <TextInput
              accessibilityLabel="Dive site"
              placeholder="Cala de la Mar"
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
            <View style={[styles.conditionRow, Platform.OS === 'web' && styles.webConditionRow]}>
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

          <View style={[styles.panel, Platform.OS === 'web' && styles.webEquipmentPanel]}>
            <Text style={styles.panelTitle}>Equipment setup</Text>
            <Text style={styles.label}>Gas mix</Text>
            <View style={[styles.gasRow, Platform.OS === 'web' && styles.webGasRow]}>
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
            <View style={[styles.noticeRow, Platform.OS === 'web' && styles.webNoticeRow]}>
              <Text style={styles.noticeIcon}>!</Text>
              <Text style={styles.noticeText}>Confirm the local tide, exit route and emergency contact before departure.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.panel, Platform.OS === 'web' && styles.webChecklistPanel]}>
          <View style={styles.checklistHeading}>
            <View>
              <Text style={styles.panelTitle}>Equipment checklist</Text>
              <Text style={styles.panelSubtitle}>Mark each item before you leave the dock.</Text>
            </View>
            <Text style={styles.checklistCount}>{completed} of {CHECKLIST.length}</Text>
          </View>
          <View style={[styles.checklistGroups, Platform.OS === 'web' && styles.webChecklistGroups]}>
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
                    <Text style={styles.checkLabel} numberOfLines={1}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.panel, Platform.OS === 'web' && styles.webNotesPanel]}>
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
      </ScrollView>

      <View style={[styles.saveBar, Platform.OS === 'web' && styles.webSaveBar]}>
        <View style={styles.saveCopy}>
          <Text style={styles.saveTitle}>{saved ? 'Plan saved locally' : 'Ready to plan?'}</Text>
          <Text style={styles.saveHint}>{saved ? 'You can keep editing this plan.' : `${completed}/${CHECKLIST.length} equipment checks complete`}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={savePlan} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saved ? 'Saved' : 'Save plan'}</Text>
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
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 42 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderRadius: 22, padding: 24, marginBottom: 18, borderWidth: 1, borderColor: '#c5e9f3' },
  webHero: { zIndex: 8, marginBottom: -8, boxShadow: '0 10px 24px rgba(0, 119, 204, 0.16)' } as any,
  heroCopy: { flex: 1, paddingRight: 20 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 7 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, marginTop: 7, lineHeight: 21 },
  progressBadge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#00A8A8' },
  progressValue: { color: '#0077CC', fontWeight: 'bold', fontSize: 22 },
  progressLabel: { color: '#587080', fontSize: 12, marginTop: 2 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 18 },
  webFormGrid: { flexWrap: 'nowrap', width: 1040 },
  panel: { flex: 1, minWidth: 300, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe6ee', padding: 20, marginBottom: 18 },
  webEquipmentPanel: { minWidth: 470, marginLeft: -28, zIndex: 2, boxShadow: '0 14px 24px rgba(0, 119, 204, 0.18)' } as any,
  panelTitle: { color: '#1e293b', fontSize: 19, fontWeight: 'bold', marginBottom: 5 },
  panelSubtitle: { color: '#6b7c8d', fontSize: 13, marginBottom: 16 },
  label: { color: '#334155', fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 7 },
  input: { width: '100%', minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 11, color: '#1e293b', fontSize: 15 },
  twoFields: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1, minWidth: 0 },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  webConditionRow: { width: 570, flexWrap: 'nowrap' },
  chip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  chipText: { color: '#0077CC', fontSize: 13, fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
  gasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  webGasRow: { width: 540, flexWrap: 'nowrap' },
  gasOption: { minWidth: 92, borderRadius: 13, borderWidth: 1, borderColor: '#c9e4f4', padding: 11, alignItems: 'center', backgroundColor: '#f7fbff' },
  gasOptionActive: { backgroundColor: '#e2f7f5', borderColor: '#00A8A8' },
  gasText: { color: '#3c5b70', fontSize: 13, fontWeight: 'bold' },
  gasTextActive: { color: '#008d8d' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, paddingVertical: 3 },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { color: '#334155', fontWeight: 'bold', fontSize: 15 },
  toggleHint: { color: '#728396', fontSize: 12, marginTop: 3 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: '#fff6dc', padding: 12, marginTop: 18, gap: 9 },
  webNoticeRow: { width: 600, alignSelf: 'flex-start' },
  noticeIcon: { width: 22, height: 22, lineHeight: 22, textAlign: 'center', borderRadius: 11, backgroundColor: '#f4b942', color: '#fff', fontWeight: 'bold' },
  noticeText: { color: '#795d20', fontSize: 12, flex: 1, lineHeight: 17 },
  checklistHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  checklistCount: { color: '#00A8A8', fontWeight: 'bold', marginTop: 3 },
  checklistGroups: { gap: 18 },
  webChecklistPanel: { overflow: 'hidden', boxShadow: '0 12px 22px rgba(0, 0, 0, 0.2)' } as any,
  webChecklistGroups: { width: 1010, flexDirection: 'row', flexWrap: 'nowrap', gap: 18 },
  checklistGroup: { flex: 1, minWidth: 260 },
  groupLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 9 },
  checkItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fbfd', borderRadius: 14, borderWidth: 1, borderColor: '#e0edf4', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9 },
  checkItemActive: { backgroundColor: '#edfbf9', borderColor: '#91ddd5' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#aac8d8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#00A8A8', borderColor: '#00A8A8' },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  checkLabel: { color: '#334155', flex: 1, fontSize: 13 },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  webNotesPanel: { marginTop: -12, zIndex: 1 },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dbe6ee' },
  webSaveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 78, zIndex: 20, boxShadow: '0 -8px 18px rgba(15, 23, 42, 0.2)' } as any,
  saveCopy: { flex: 1 },
  saveTitle: { color: '#1e293b', fontWeight: 'bold', fontSize: 14 },
  saveHint: { color: '#728396', fontSize: 12, marginTop: 3 },
  saveButton: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, minWidth: 105, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  logButton: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, minWidth: 90, alignItems: 'center' },
  logButtonText: { color: '#008d8d', fontWeight: 'bold' },
});
