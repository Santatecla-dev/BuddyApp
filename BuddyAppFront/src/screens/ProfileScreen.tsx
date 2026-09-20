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
    setErrorMessage('');
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
      setErrorMessage('Could not load the profile or shared dives.');
    }
  };

  useEffect(() => {
    setProfile(null);
    setIsEditing(false);
    setErrorMessage('');
    setDivesWithMe(null);
    fetchProfile();
  }, [viewedUserId]);

  const [saving, setSaving] = useState(false);
  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage('');
    try {
      const certsArray = certificationsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await API.patch('/users/me', { agency, certifications: certsArray });

      setIsEditing(false);
      setTempMessage('Profile updated.');

      fetchProfile();
    } catch (err) {
      console.log(err);
      setErrorMessage('Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text accessibilityRole={errorMessage ? 'alert' : undefined}>{errorMessage || 'Loading profile...'}</Text>
        {errorMessage ? <TouchableOpacity accessibilityRole="button" style={styles.editButton} onPress={fetchProfile}><Text style={styles.editButtonText}>Retry</Text></TouchableOpacity> : null}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f7f9fc' }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.title}>
        {isOwnProfile ? 'My profile' : 'Buddy profile'}
      </Text>

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={{ flexGrow: 1, flexBasis: 220, minWidth: 0 }}>
            <Text style={styles.label}>Full name</Text>
            <Text style={styles.value}>{profile.name}</Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>

            <Text style={styles.label}>Diver ID</Text>
            <Text style={styles.value}>{profile.id}</Text>

            <Text style={styles.label}>Total dives</Text>
            <Text style={styles.value}>
              {totalDives !== null ? totalDives : 'Loading...'}
            </Text>
          </View>

          {!isOwnProfile && divesWithMe !== null && (
            <View style={styles.divesWithMe}>
              <Text style={styles.divesWithMeLabel}>Dives together</Text>
              <Text style={styles.divesWithMeValue}>{divesWithMe}</Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Agency</Text>
        {isEditing ? (
          <TextInput
            accessibilityLabel="Agency"
            value={agency}
            onChangeText={setAgency}
            style={[styles.input, styles.inputEditable]}
            placeholder="SSI, PADI, etc."
          />
        ) : (
          <Text style={styles.value}>{profile.agency || 'Not specified'}</Text>
        )}

        <Text style={styles.label}>Certifications</Text>
        {isEditing ? (
          <TextInput
            accessibilityLabel="Certifications, separated by commas"
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
          <Text style={styles.value}>Not specified</Text>
        )}
      </View>

      {errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
      {tempMessage ? <Text accessibilityLiveRegion="polite" style={styles.successText}>{tempMessage}</Text> : null}

      {isOwnProfile ? (
        <TouchableOpacity accessibilityRole="button"
          style={[styles.editButton, isEditing && { backgroundColor: '#007F83' }]}
          disabled={saving}
          accessibilityState={{ disabled: saving, busy: saving }}
          onPress={isEditing ? saveProfile : () => { setTempMessage(''); setIsEditing(true); }}
        >
          <Text style={styles.editButtonText}>
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Edit profile'}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.readOnlyNote}>This profile is read-only</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 40 },

  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, color: '#0077CC' },

  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },


  topRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', marginBottom: 10 },

  divesWithMe: {
    backgroundColor: '#E0F7FA',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',

    minWidth: 80,
  },

  divesWithMeLabel: { fontSize: 12, fontWeight: 'bold', color: '#0077CC' },
  divesWithMeValue: { fontSize: 18, fontWeight: 'bold', color: '#0077CC' },

  label: { fontWeight: 'bold', marginTop: 10, color: '#555' },
  value: { color: '#243247', fontSize: 16, marginTop: 4 },


  input: {
    color: '#243247',
    fontSize: 16,
    minHeight: 48,
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

  errorText: { color: '#B42318', marginBottom: 10, textAlign: 'center' },

  successText: { color: 'green', marginBottom: 10, textAlign: 'center' },
});
