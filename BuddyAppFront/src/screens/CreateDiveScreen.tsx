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

const COUNTRIES = [
  'Afganistán','Albania','Argelia','Andorra','Angola','Antigua y Barbuda','Argentina','Armenia','Australia','Austria','Azerbaiyán',
  'Bahamas','Baréin','Bangladés','Barbados','Bielorrusia','Bélgica','Belice','Benín','Bután','Bolivia','Bosnia y Herzegovina',
  'Botsuana','Brasil','Brunéi','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Camboya','Camerún','Canadá','República Centroafricana',
  'Chad','Chile','China','Colombia','Comoras','Congo','Costa de Marfil','Costa Rica','Croacia','Cuba','Chipre','República Checa',
  'Dinamarca','Yibuti','Dominica','República Dominicana','Ecuador','Egipto','El Salvador','Guinea Ecuatorial','Eritrea','Estonia',
  'Esuatini','Etiopía','Fiyi','Finlandia','Francia','Gabón','Gambia','Georgia','Alemania','Ghana','Grecia','Granada','Guatemala',
  'Guinea','Guinea-Bisáu','Guyana','Haití','Honduras','Hungría','Islandia','India','Indonesia','Irán','Irak','Irlanda','Israel',
  'Italia','Jamaica','Japón','Jordania','Kazajistán','Kenia','Kiribati','Kuwait','Kirguistán','Laos','Letonia','Líbano','Lesoto',
  'Liberia','Libia','Liechtenstein','Lituania','Luxemburgo','Madagascar','Malaui','Malasia','Maldivas','Malí','Malta','Islas Marshall',
  'Mauritania','Mauricio','México','Estados Federados de Micronesia','Moldavia','Mónaco','Mongolia','Montenegro','Marruecos',
  'Mozambique','Birmania','Namibia','Nauru','Nepal','Países Bajos','Nueva Zelanda','Nicaragua','Níger','Nigeria','Corea del Norte',
  'Macedonia del Norte','Noruega','Omán','Pakistán','Palaos','Panamá','Papúa Nueva Guinea','Paraguay','Perú','Filipinas','Polonia',
  'Portugal','Catar','Rumanía','Federación Rusa','Ruanda','San Cristóbal y Nieves','Santa Lucía','San Vicente y las Granadinas',
  'Samoa','San Marino','Santo Tomé y Príncipe','Arabia Saudita','Senegal','Serbia','Seychelles','Sierra Leona','Singapur','Eslovaquia',
  'Eslovenia','Islas Salomón','Somalia','Sudáfrica','Sudán del Sur','España','Sri Lanka','Sudán','Surinam','Suecia','Suiza','Siria',
  'Tayikistán','Tailandia','Timor-Leste','Togo','Tonga','Trinidad y Tobago','Túnez','Turquía','Turkmenistán','Tuvalu','Uganda',
  'Ucrania','Emiratos Árabes Unidos','Reino Unido','República Unida de Tanzania','Estados Unidos de América','Uruguay','Uzbekistán',
  'Vanuatu','Venezuela','Vietnam','Yemen','Zambia','Zimbabue','Taiwán'
];

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

    if (!country) newErrors.country = 'Debes seleccionar un país';

    if (!location.trim()) newErrors.location = 'Introduce el lugar de la inmersión';
    const d = Number(day), m = Number(month), y = Number(year);
    const date = new Date(0);
    date.setFullYear(y, m - 1, d);
    if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year) || y < 1 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) newErrors.date = 'Introduce una fecha válida (DD/MM/AAAA)';
    if (hour && (!/^\d{1,2}$/.test(hour) || Number(hour) > 23)) newErrors.hour = 'La hora debe estar entre 0 y 23';
    if (!/^\d+$/.test(maxDepth) || !Number.isSafeInteger(Number(maxDepth)) || Number(maxDepth) <= 0) newErrors.maxDepth = 'Introduce una profundidad positiva en metros enteros';
    if (!/^\d+$/.test(duration) || !Number.isSafeInteger(Number(duration)) || Number(duration) <= 0) newErrors.duration = 'Introduce una duración positiva en minutos enteros';

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
      setSubmitError('No se pudo crear la inmersión. Inténtalo de nuevo.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const error = (key: string) => errors[key] ? <Text accessibilityRole="alert" style={styles.errorText}>{errors[key]}</Text> : null;
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.label}>País</Text>
        <View style={Platform.OS === 'web' ? undefined : styles.dropdown}>
          <Picker accessibilityLabel="País" selectedValue={country} onValueChange={v => setCountry(String(v))} mode="dialog" prompt="Selecciona un país" style={Platform.OS === 'web' ? styles.input : styles.nativePicker}>
            <Picker.Item label="Selecciona un país..." value="" />
            {COUNTRIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
          </Picker>
        </View>
        {error('country')}
        <Text style={styles.label}>Lugar</Text>
        <TextInput accessibilityLabel="Lugar" placeholder="Nombre del punto de buceo" value={location} onChangeText={setLocation} style={styles.input} />
        {error('location')}
        <Text style={styles.label}>Fecha y hora local</Text>
        <View style={styles.dateRow}>
          {[
            { label: 'Día', placeholder: 'DD', value: day, set: setDay, length: 2 },
            { label: 'Mes', placeholder: 'MM', value: month, set: setMonth, length: 2 },
            { label: 'Año', placeholder: 'AAAA', value: year, set: setYear, length: 4 },
            { label: 'Hora (opcional)', placeholder: 'HH', value: hour, set: setHour, length: 2 },
          ].map(field => <View key={field.label} style={[styles.dateField, compact && styles.compactField]}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput accessibilityLabel={field.label} placeholder={field.placeholder} value={field.value} onChangeText={field.set} keyboardType="number-pad" maxLength={field.length} style={styles.input} />
          </View>)}
        </View>
        {error('date')}{error('hour')}
        <Text style={styles.label}>Profundidad máxima (m)</Text>
        <TextInput accessibilityLabel="Profundidad máxima en metros" placeholder="30" value={maxDepth} onChangeText={setMaxDepth} style={styles.input} keyboardType="number-pad" />
        {error('maxDepth')}
        <Text style={styles.label}>Duración (minutos)</Text>
        <TextInput accessibilityLabel="Duración en minutos" placeholder="45" value={duration} onChangeText={setDuration} style={styles.input} keyboardType="number-pad" />
        {error('duration')}
        <Text style={styles.label}>Notas (opcional)</Text>
        <TextInput accessibilityLabel="Notas" value={notes} onChangeText={setNotes} style={[styles.input, styles.notes]} multiline />
        {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} style={[styles.mainButton, saving && styles.disabled]} onPress={createDive}>
          <Text style={styles.buttonText}>{saving ? 'Creando…' : 'Crear inmersión'}</Text>
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
