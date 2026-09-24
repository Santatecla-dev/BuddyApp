import React, { useEffect, useRef, useState } from 'react';
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
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import API from '../api/api';
import { PokedexSpecies } from '../types';
import CenterSearchField from '../components/CenterSearchField';
import { getNewAchievementIds, getUnlockedAchievementIds } from '../utils/achievements';

export const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala',
  'Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands',
  'Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco',
  'Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea',
  'North Macedonia','Norway','Oman','Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia',
  'Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Tajikistan','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','Tanzania','United States','Uruguay','Uzbekistan',
  'Vanuatu','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Taiwan'
];

export default function CreateDiveScreen({ navigation }: any) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 480;
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [centerId, setCenterId] = useState('');

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [hour, setHour] = useState('');

  const [maxDepth, setMaxDepth] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [speciesCatalog, setSpeciesCatalog] = useState<PokedexSpecies[]>([]);
  const [sightings, setSightings] = useState<string[]>([]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    API.get('/pokedex/species')
      .then((response) => setSpeciesCatalog(response.data))
      .catch(() => setSpeciesCatalog([]));
  }, []);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!country) newErrors.country = 'You must select a country';

    if (!location.trim()) newErrors.location = 'Enter dive location';
    const d = Number(day), m = Number(month), y = Number(year);
    const date = new Date(0);
    date.setFullYear(y, m - 1, d);
    if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year) || y < 1 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) newErrors.date = 'Enter a valid date (DD/MM/YYYY)';
    if (hour && (!/^\d{1,2}$/.test(hour) || Number(hour) > 23)) newErrors.hour = 'Hour must be between 0 and 23';
    if (!/^\d+$/.test(maxDepth) || !Number.isSafeInteger(Number(maxDepth)) || Number(maxDepth) <= 0) newErrors.maxDepth = 'Enter a positive whole number for depth';
    if (!/^\d+$/.test(duration) || !Number.isSafeInteger(Number(duration)) || Number(duration) <= 0) newErrors.duration = 'Enter a positive whole number for duration';

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
      const previousAchievements = await getUnlockedAchievementIds();
      await API.post('/dives', {
        country,
        location: location.trim(),
        date: dateObj.toISOString(),
        maxDepth: parseInt(maxDepth),
        duration: parseInt(duration),
        notes,
        sightings,
        centerId: centerId ? Number(centerId) : undefined,
      });

      const newAchievements = await getNewAchievementIds(previousAchievements);
      if (newAchievements.length) navigation.navigate('Achievements', { celebrateIds: newAchievements, celebrationKey: String(Date.now()) });
      else navigation.navigate('MyDives');
    } catch {
      setSubmitError('Could not create dive. Please try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const toggleSighting = (speciesKey: string) => {
    setSightings((current) => current.includes(speciesKey)
      ? current.filter((key) => key !== speciesKey)
      : [...current, speciesKey]);
  };

  const error = (key: string) => errors[key] ? <Text accessibilityRole="alert" style={styles.errorText}>{errors[key]}</Text> : null;
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.label}>Country</Text>
        <View style={Platform.OS === 'web' ? undefined : styles.dropdown}>
          <Picker accessibilityLabel="Country" selectedValue={country} onValueChange={v => setCountry(String(v))} mode="dialog" prompt="Select country" style={Platform.OS === 'web' ? styles.input : styles.nativePicker}>
            <Picker.Item label="Select country..." value="" />
            {COUNTRIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
          </Picker>
        </View>
        {error('country')}
        <Text style={styles.label}>Location</Text>
        <TextInput accessibilityLabel="Location" placeholder="Dive site name" value={location} onChangeText={setLocation} style={styles.input} />
        {error('location')}
        <Text style={styles.label}>Request dive center link (optional)</Text>
        <CenterSearchField selectedCenterId={centerId} onSelect={(center) => setCenterId(center ? String(center.id) : '')} label="Request dive center link (optional)" />
        <Text style={styles.label}>Date and Local Time</Text>
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
        <Text style={styles.label}>Max Depth (m)</Text>
        <TextInput accessibilityLabel="Max depth in meters" placeholder="30" value={maxDepth} onChangeText={setMaxDepth} style={styles.input} keyboardType="number-pad" />
        {error('maxDepth')}
        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput accessibilityLabel="Duration in minutes" placeholder="45" value={duration} onChangeText={setDuration} style={styles.input} keyboardType="number-pad" />
        {error('duration')}
        <View style={styles.sightingSection}>
          <View style={styles.sightingHeader}>
            <View style={styles.sightingHeaderCopy}>
              <Text style={styles.label}>Marine life sighted (optional)</Text>
              <Text style={styles.sightingHint}>Select each species you saw on this dive.</Text>
            </View>
            <Text style={styles.sightingCount}>{sightings.length}</Text>
          </View>
          <View style={styles.sightingGrid}>
            {speciesCatalog.map((species) => {
              const selected = sightings.includes(species.key);
              return (
                <TouchableOpacity
                  key={species.key}
                  accessibilityRole="checkbox"
                  accessibilityLabel={species.name}
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleSighting(species.key)}
                  style={[styles.sightingOption, selected && styles.sightingOptionSelected]}
                >
                  <Image source={{ uri: species.imageUrl }} style={styles.sightingImage} />
                  <Text numberOfLines={2} style={[styles.sightingName, selected && styles.sightingNameSelected]}>{species.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput accessibilityLabel="Notes" value={notes} onChangeText={setNotes} style={[styles.input, styles.notes]} multiline />
        {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} style={[styles.mainButton, saving && styles.disabled]} onPress={createDive}>
          <Text style={styles.buttonText}>{saving ? 'Creating…' : 'Create dive'}</Text>
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
  sightingSection: { marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: '#eef8fc', borderWidth: 1, borderColor: '#c8e6f2' },
  sightingHeaderCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  sightingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sightingHint: { color: '#607789', fontSize: 12, marginTop: -4, marginBottom: 12 },
  sightingCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#0077CC', color: '#fff', textAlign: 'center', lineHeight: 28, fontWeight: 'bold' },
  sightingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  sightingOption: { width: 112, maxWidth: '100%', minHeight: 120, borderRadius: 13, padding: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d5e7ef' },
  sightingOptionSelected: { borderColor: '#00A8A8', backgroundColor: '#e4f8f5' },
  sightingImage: { width: '100%', height: 70, borderRadius: 9, backgroundColor: '#dcebf1' },
  sightingName: { color: '#425466', fontSize: 11, fontWeight: 'bold', marginTop: 6 },
  sightingNameSelected: { color: '#008d8d' },
  errorText: { color: '#B42318', fontSize: 14, marginTop: 6 },
  mainButton: { backgroundColor: '#0077CC', minHeight: 48, padding: 15, borderRadius: 30, alignItems: 'center', marginTop: 24 },
  disabled: { opacity: 0.65 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
});
