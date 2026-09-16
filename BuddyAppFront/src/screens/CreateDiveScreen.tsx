import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
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
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('Balicasag Island');

  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [hour, setHour] = useState('');

  const [maxDepth, setMaxDepth] = useState('30');
  const [duration, setDuration] = useState('45');
  const [notes, setNotes] = useState('Agua increíble');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!country) newErrors.country = 'Debes seleccionar un país';

    if (!day || !month || !year) {
      newErrors.date = 'Completa día, mes y año';
    } else {
      const d = parseInt(day);
      const m = parseInt(month);
      const h = hour ? parseInt(hour) : 0;

      if (m < 1 || m > 12) {
        newErrors.date = 'El mes debe estar entre 1 y 12';
      } else {
        const daysInMonth: Record<number, number> = {
          1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
          7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
        };
        if (d < 1 || d > daysInMonth[m]) {
          newErrors.date = 'El día no es válido para ese mes';
        }
      }

      if (hour && (h < 0 || h > 23)) {
        newErrors.hour = 'La hora debe estar entre 0 y 23';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createDive = async () => {
    if (!validate()) return;

    const dateObj = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour ? parseInt(hour) : 0
    );

    try {
      await API.post('/dives', {
        country,
        location,
        date: dateObj.toISOString(),
        maxDepth: parseInt(maxDepth),
        duration: parseInt(duration),
        notes,
      });

      Alert.alert('Éxito', 'Inmersión creada');
      navigation.navigate('MyDives');
    } catch {
      Alert.alert('Error', 'No se pudo crear la inmersión');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>País</Text>
      <View style={styles.dropdown}>
        <Picker selectedValue={country} onValueChange={(v) => setCountry(String(v))}>
          <Picker.Item label="Selecciona un país..." value="" color="#999" />
          {COUNTRIES.map((c) => (
            <Picker.Item key={c} label={c} value={c} />
          ))}
        </Picker>
      </View>
      {errors.country && <Text style={styles.errorText}>{errors.country}</Text>}

      <Text style={styles.label}>Lugar</Text>
      <TextInput value={location} onChangeText={setLocation} style={styles.input} />

      <Text style={styles.label}>Fecha</Text>
      
      <View style={styles.dateRow}>
        <TextInput placeholder="DD" value={day} onChangeText={setDay} keyboardType="numeric" maxLength={2} style={[styles.input, styles.smallInput]} />
        <TextInput placeholder="MM" value={month} onChangeText={setMonth} keyboardType="numeric" maxLength={2} style={[styles.input, styles.smallInput]} />
        <TextInput placeholder="AAAA" value={year} onChangeText={setYear} keyboardType="numeric" maxLength={4} style={[styles.input, styles.fullInput]} />
        <TextInput placeholder="HH" value={hour} onChangeText={setHour} keyboardType="numeric" maxLength={2} style={[styles.input, styles.smallInput]} />
      </View>

      {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
      {errors.hour && <Text style={styles.errorText}>{errors.hour}</Text>}

      <Text style={styles.label}>Profundidad máxima</Text>
      <TextInput value={maxDepth} onChangeText={setMaxDepth} style={styles.input} keyboardType="numeric" />

      <Text style={styles.label}>Duración (minutos)</Text>
      <TextInput value={duration} onChangeText={setDuration} style={styles.input} keyboardType="numeric" />

     
      <TouchableOpacity style={styles.mainButton} onPress={createDive}>
        <Text style={styles.buttonText}>Crear inmersión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontWeight: 'bold', marginBottom: 2, color: '#333' }, // Margen inferior reducido sutilmente
  dropdown: {
    borderWidth: 1,
    borderColor: '#0077CC',
    borderRadius: 30,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0077CC',
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8, // Padding vertical modificado
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -5, 
  },
  smallInput: {
    width: '55%',
    textAlign: 'center',
  },
  fullInput: {
    width: '100%',
    textAlign: 'center',
  },
  errorText: { color: 'red', fontSize: 11, marginBottom: 6 },
  mainButton: {
    backgroundColor: '#0077CC',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 30, 
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});