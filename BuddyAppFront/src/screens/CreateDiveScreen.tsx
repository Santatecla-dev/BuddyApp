import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import API from '../api/api';

import { countries } from '../utils/countries';
const sortedCountries = [...countries].sort((a, b) => a.label.localeCompare(b.label, 'en'));

export default function CreateDiveScreen({ navigation }: any) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 480;
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [hour, setHour] = useState('');

  const [maxDepth, setMaxDepth] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!country) newErrors.country = 'Select a country.';

    if (!location.trim()) newErrors.location = 'Enter the dive location.';
    const d = Number(day), m = Number(month), y = Number(year);
    const date = new Date(0);
    date.setFullYear(y, m - 1, d);
    if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year) || y < 1 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) newErrors.date = 'Enter a valid date (DD/MM/YYYY).';
    if (hour && (!/^\d{1,2}$/.test(hour) || Number(hour) > 23)) newErrors.hour = 'Hour must be between 0 and 23.';
    if (!/^\d+$/.test(maxDepth) || !Number.isSafeInteger(Number(maxDepth)) || Number(maxDepth) <= 0) newErrors.maxDepth = 'Enter a positive depth in whole meters.';
    if (!/^\d+$/.test(duration) || !Number.isSafeInteger(Number(duration)) || Number(duration) <= 0) newErrors.duration = 'Enter a positive duration in whole minutes.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createDive = async () => {
    if (submitting.current || !validate()) return;
    submitting.current = true;
    setSaving(true);
    setSubmitError('');
    const dateObj = new Date(0);
    dateObj.setFullYear(Number(year), Number(month) - 1, Number(day));
    dateObj.setHours(Number(hour || 0), 0, 0, 0);

    try {
      await API.post('/dives', {
        country,
        location: location.trim(),
        date: dateObj.toISOString(),
        maxDepth: parseInt(maxDepth),
        duration: parseInt(duration),
        notes,
      });

      navigation.navigate('MyDives');
    } catch {
      setSubmitError('Could not create the dive. Please try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const error = (key: string) => errors[key] ? <Text accessibilityRole="alert" style={styles.errorText}>{errors[key]}</Text> : null;
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.label}>Country</Text>
        <View style={Platform.OS === 'web' ? undefined : styles.dropdown}>
          <Picker accessibilityLabel="Country" selectedValue={country} onValueChange={v => setCountry(String(v))} mode="dialog" prompt="Select a country" style={Platform.OS === 'web' ? styles.input : styles.nativePicker}>
            <Picker.Item label="Select a country..." value="" />
            {sortedCountries.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} />)}
          </Picker>
        </View>
        {error('country')}
        <Text style={styles.label}>Location</Text>
        <TextInput accessibilityLabel="Location" placeholder="Dive site name" value={location} onChangeText={setLocation} style={styles.input} />
        {error('location')}
        <Text style={styles.label}>Local date and time</Text>
        <View style={styles.dateRow}>
          {[
            { label: 'Day', placeholder: 'DD', value: day, set: setDay, length: 2 },
            { label: 'Month', placeholder: 'MM', value: month, set: setMonth, length: 2 },
            { label: 'Year', placeholder: 'YYYY', value: year, set: setYear, length: 4 },
            { label: 'Hour (optional)', placeholder: 'HH', value: hour, set: setHour, length: 2 },
          ].map(field => <View key={field.label} style={[styles.dateField, compact && styles.compactField]}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput accessibilityLabel={field.label} placeholder={field.placeholder} value={field.value} onChangeText={field.set} keyboardType="number-pad" maxLength={field.length} style={styles.input} />
          </View>)}
        </View>
        {error('date')}{error('hour')}
        <Text style={styles.label}>Maximum depth (m)</Text>
        <TextInput accessibilityLabel="Maximum depth in meters" placeholder="30" value={maxDepth} onChangeText={setMaxDepth} style={styles.input} keyboardType="number-pad" />
        {error('maxDepth')}
        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput accessibilityLabel="Duration in minutes" placeholder="45" value={duration} onChangeText={setDuration} style={styles.input} keyboardType="number-pad" />
        {error('duration')}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput accessibilityLabel="Notes" value={notes} onChangeText={setNotes} style={[styles.input, styles.notes]} multiline />
        {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} style={[styles.mainButton, saving && styles.disabled]} onPress={createDive}>
          <Text style={styles.buttonText}>{saving ? 'Creating…' : 'Log dive'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  label: { fontWeight: 'bold', fontSize: 16, marginTop: 16, marginBottom: 8, color: '#333' },
  fieldLabel: { fontSize: 14, color: '#555', marginBottom: 6 },
  dropdown: { borderWidth: 1, borderColor: '#0077CC', borderRadius: 24, backgroundColor: '#fff' },
  nativePicker: { width: '100%', color: '#333', minHeight: 52 },
  input: { width: '100%', minWidth: 0, minHeight: 52, backgroundColor: '#fff', color: '#333', fontSize: 16, borderWidth: 1, borderColor: '#0077CC', borderRadius: 24, paddingHorizontal: 15, paddingVertical: 12 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateField: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  compactField: { flexBasis: '40%' },
  notes: { minHeight: 104, textAlignVertical: 'top' },
  errorText: { color: '#B42318', fontSize: 14, marginTop: 6 },
  mainButton: { backgroundColor: '#0077CC', minHeight: 48, padding: 15, borderRadius: 30, alignItems: 'center', marginTop: 24 },
  disabled: { opacity: 0.65 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
});
