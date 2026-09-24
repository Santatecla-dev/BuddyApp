import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import API from '../api/api';
import { COUNTRIES } from './CreateDiveScreen';

export default function CenterLogDiveScreen({ navigation }: any) {
  const now = new Date();
  const [form, setForm] = useState({ date: now.toISOString().slice(0, 10), country: '', location: '', depth: '', duration: '', buddyIds: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.date || !form.country || !form.location.trim() || !form.depth || !form.duration) {
      setError('Date, country, location, depth and duration are required.');
      return;
    }
    const buddyUserIds = form.buddyIds.split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
    setSaving(true); setError('');
    try {
      await API.post('/center/dives', { date: new Date(`${form.date}T12:00:00`).toISOString(), country: form.country, location: form.location.trim(), maxDepth: Number(form.depth), duration: Number(form.duration), notes: form.notes.trim() || undefined, buddyUserIds });
      if (Platform.OS === 'web') window.alert('Dive logged and invitations sent to the selected buddies.');
      else Alert.alert('Dive logged', 'Invitations sent to the selected buddies.');
      navigation.goBack();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Could not log this dive.');
    } finally { setSaving(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.card}>
      <Text style={styles.eyebrow}>CENTER OPERATIONS</Text>
      <Text style={styles.title}>Log a dive</Text>
      <Text style={styles.subtitle}>Create a dive under this center and send invitations to divers who joined it.</Text>
      <Text style={styles.label}>Date</Text><TextInput accessibilityLabel="Dive date" value={form.date} onChangeText={(value) => set('date', value)} placeholder="YYYY-MM-DD" style={styles.input} />
      <Text style={styles.label}>Country</Text><View style={styles.pickerWrap}><Picker accessibilityLabel="Dive country" selectedValue={form.country} onValueChange={(value) => set('country', String(value))} style={styles.picker}><Picker.Item label="Select country" value="" />{COUNTRIES.map((country) => <Picker.Item key={country} label={country} value={country} />)}</Picker></View>
      <Text style={styles.label}>Dive site</Text><TextInput accessibilityLabel="Dive site" value={form.location} onChangeText={(value) => set('location', value)} placeholder="Blue Hole" style={styles.input} />
      <View style={styles.row}><View style={styles.half}><Text style={styles.label}>Max depth (m)</Text><TextInput accessibilityLabel="Maximum depth" keyboardType="numeric" value={form.depth} onChangeText={(value) => set('depth', value)} placeholder="25" style={styles.input} /></View><View style={styles.half}><Text style={styles.label}>Duration (min)</Text><TextInput accessibilityLabel="Duration" keyboardType="numeric" value={form.duration} onChangeText={(value) => set('duration', value)} placeholder="45" style={styles.input} /></View></View>
      <Text style={styles.label}>Buddy user IDs (optional)</Text><TextInput accessibilityLabel="Buddy user IDs" value={form.buddyIds} onChangeText={(value) => set('buddyIds', value)} placeholder="12, 24, 31" style={styles.input} /><Text style={styles.hint}>Separate IDs with commas. Each diver receives an invitation.</Text>
      <Text style={styles.label}>Notes</Text><TextInput accessibilityLabel="Dive notes" multiline value={form.notes} onChangeText={(value) => set('notes', value)} style={[styles.input, styles.notes]} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <TouchableOpacity accessibilityRole="button" disabled={saving} style={[styles.button, saving && styles.disabled]} onPress={save}><Text style={styles.buttonText}>{saving ? 'Logging…' : 'Log dive and invite buddies'}</Text></TouchableOpacity>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f8' }, content: { padding: 20, width: '100%', maxWidth: 720, alignSelf: 'center' }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 22, padding: 22 }, eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.1 }, title: { color: '#123b52', fontSize: 27, fontWeight: 'bold', marginTop: 5 }, subtitle: { color: '#627687', lineHeight: 20, marginTop: 7 }, label: { color: '#123b52', fontSize: 13, fontWeight: 'bold', marginTop: 15, marginBottom: 6 }, input: { minHeight: 46, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', backgroundColor: '#fff' }, pickerWrap: { borderWidth: 1, borderColor: '#aabfc7', borderRadius: 11, overflow: 'hidden' }, picker: { height: 46, color: '#334155' }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1, minWidth: 0 }, hint: { color: '#718394', fontSize: 11, marginTop: 5 }, notes: { minHeight: 90, textAlignVertical: 'top' }, error: { color: '#b42318', marginTop: 12 }, button: { backgroundColor: '#123b52', borderRadius: 22, padding: 14, alignItems: 'center', marginTop: 20 }, disabled: { opacity: 0.6 }, buttonText: { color: '#fff', fontWeight: 'bold' },
});
