import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import API from '../api/api';

type Profile = {
  id: number;
  name: string;
  email: string;
  agency?: string;
  certifications?: string[];
  totalDives: number;
  dives?: { userId: number }[]; // todos los buddies en sus dives
};

export default function ProfileScreen({ route }: any) {
  const viewedUserId: number | null = route?.params?.userId ?? null;
  const isOwnProfile = viewedUserId === null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempMessage, setTempMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [agency, setAgency] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certificationsText, setCertificationsText] = useState('');

  const [totalDives, setTotalDives] = useState<number | null>(null);
  const [divesWithMe, setDivesWithMe] = useState<number | null>(null); // 🔹 nuevo

  const fetchProfile = async () => {
    try {
      const res = isOwnProfile
        ? await API.get('/users/me')
        : await API.get(`/users/${viewedUserId}`);
      const data: Profile = res.data;

      setProfile(data);
      setAgency(data.agency || '');
      setCertifications(data.certifications || []);
      setCertificationsText((data.certifications || []).join(', '));
      setTotalDives(data.totalDives);

      // 🔹 calcular inmersiones contigo si no es tu perfil
if (!isOwnProfile) {
  const sharedRes = await API.get(`/users/${viewedUserId}/shared-dives`);
  setDivesWithMe(sharedRes.data.sharedDives);
}
    } catch (err) {
      console.log('Error cargando perfil o inmersiones', err);
      setErrorMessage('No se pudieron cargar las inmersiones');
    }
  };

  useEffect(() => {
    setProfile(null);
    setIsEditing(false);
    setErrorMessage('');
    setDivesWithMe(null);
    fetchProfile();
  }, [viewedUserId]);

  const saveProfile = async () => {
    try {
      const certsArray = certificationsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await API.patch('/users/me', { agency, certifications: certsArray });

      setIsEditing(false);
      setTempMessage('Perfil actualizado');
      setTimeout(() => setTempMessage(''), 3000);

      fetchProfile();
    } catch (err) {
      console.log(err);
      setErrorMessage('Error al actualizar perfil');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text accessibilityRole={errorMessage ? 'alert' : undefined}>{errorMessage || 'Cargando perfil...'}</Text>
        {errorMessage ? <TouchableOpacity accessibilityRole="button" style={styles.editButton} onPress={fetchProfile}><Text style={styles.editButtonText}>Reintentar</Text></TouchableOpacity> : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {isOwnProfile ? 'Mi perfil' : 'Perfil del buddy'}
      </Text>

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nombre completo</Text>
            <Text style={styles.value}>{profile.name}</Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>

            <Text style={styles.label}>Diver ID</Text>
            <Text style={styles.value}>{profile.id}</Text>

            <Text style={styles.label}>Inmersiones totales</Text>
            <Text style={styles.value}>
              {totalDives !== null ? totalDives : 'Cargando...'}
            </Text>
          </View>

          {!isOwnProfile && divesWithMe !== null && (
            <View style={styles.divesWithMe}>
              <Text style={styles.divesWithMeLabel}>Inmersiones contigo</Text>
              <Text style={styles.divesWithMeValue}>{divesWithMe}</Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Agencia</Text>
        {isEditing ? (
          <TextInput
            value={agency}
            onChangeText={setAgency}
            style={[styles.input, styles.inputEditable]}
            placeholder="SSI, PADI, etc."
          />
        ) : (
          <Text style={styles.value}>{profile.agency || 'No especificada'}</Text>
        )}

        <Text style={styles.label}>Titulaciones</Text>
        {isEditing ? (
          <TextInput
            value={certificationsText}
            onChangeText={setCertificationsText}
            style={[styles.input, styles.inputEditable]}
            placeholder="Open Water, Advanced, Nitrox..."
          />
        ) : certifications.length > 0 ? (
          certifications.map((c, i) => (
            <Text key={i} style={styles.value}>
              • {c}
            </Text>
          ))
        ) : (
          <Text style={styles.value}>No especificadas</Text>
        )}
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {tempMessage ? <Text style={styles.successText}>{tempMessage}</Text> : null}

      {isOwnProfile ? (
        <TouchableOpacity
          style={[styles.editButton, isEditing && { backgroundColor: '#00A8A8' }]}
          onPress={isEditing ? saveProfile : () => setIsEditing(true)}
        >
          <Text style={styles.editButtonText}>
            {isEditing ? 'Guardar cambios' : 'Editar perfil'}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.readOnlyNote}>Este perfil es solo de lectura</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },

  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, color: '#0077CC' },

  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },

  divesWithMe: {
    backgroundColor: '#E0F7FA',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    minWidth: 80,
  },

  divesWithMeLabel: { fontSize: 12, fontWeight: 'bold', color: '#0077CC' },
  divesWithMeValue: { fontSize: 18, fontWeight: 'bold', color: '#0077CC' },

  label: { fontWeight: 'bold', marginTop: 10, color: '#555' },
  value: { fontSize: 16, marginTop: 4 },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginTop: 4,
  },

  inputEditable: { backgroundColor: 'white', borderColor: '#0077CC' },

  editButton: {
    backgroundColor: '#0077CC',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },

  editButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  readOnlyNote: { textAlign: 'center', color: '#777', fontStyle: 'italic', marginTop: 10 },

  errorText: { color: 'red', marginBottom: 10, textAlign: 'center' },

  successText: { color: 'green', marginBottom: 10, textAlign: 'center' },
});
