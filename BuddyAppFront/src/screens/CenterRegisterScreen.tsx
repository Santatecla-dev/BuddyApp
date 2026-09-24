import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import API from '../api/api';
import { COUNTRIES } from './CreateDiveScreen';

export default function CenterRegisterScreen({ navigation }: any) {
  const [form, setForm] = useState({ centerName: '', name: '', email: '', password: '', city: '', country: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const register = async () => {
    if (!form.centerName.trim() || !form.name.trim() || !form.email.trim() || !form.password || !form.country) {
      setError('Center name, contact name, email, password and country are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await API.post('/auth/register-center', { ...form, centerName: form.centerName.trim(), name: form.name.trim(), email: form.email.trim() });
      if (Platform.OS === 'web') window.alert('Dive center registered. You can now log in.');
      else Alert.alert('Dive center registered', 'You can now log in.');
      navigation.goBack();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Could not register this dive center.');
    } finally {
      setSaving(false);
    }
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>BUDDY FOR BUSINESS</Text>
        <Text style={styles.title}>Register a dive center</Text>
        <Text style={styles.subtitle}>Create a center workspace to manage trips, inventory and diver clients.</Text>
        <Text style={styles.label}>Center name *</Text><TextInput accessibilityLabel="Dive center name" value={form.centerName} onChangeText={(value) => set('centerName', value)} placeholder="Blue Ocean Divers" style={styles.input} />
        <Text style={styles.label}>Contact name *</Text><TextInput accessibilityLabel="Contact name" value={form.name} onChangeText={(value) => set('name', value)} placeholder="Your name" style={styles.input} />
        <Text style={styles.label}>Account email *</Text><TextInput accessibilityLabel="Center account email" value={form.email} onChangeText={(value) => set('email', value)} keyboardType="email-address" autoCapitalize="none" placeholder="hello@blueocean.com" style={styles.input} />
        <Text style={styles.label}>Password *</Text><TextInput accessibilityLabel="Center password" value={form.password} onChangeText={(value) => set('password', value)} secureTextEntry placeholder="At least 6 characters" style={styles.input} />
        <View style={styles.row}><View style={styles.half}><Text style={styles.label}>City</Text><TextInput accessibilityLabel="Center city" value={form.city} onChangeText={(value) => set('city', value)} placeholder="Cairns" style={styles.input} /></View><View style={styles.half}><Text style={styles.label}>Country</Text><View style={styles.pickerWrap}><Picker accessibilityLabel="Center country" selectedValue={form.country} onValueChange={(value) => set('country', String(value))} style={styles.picker}><Picker.Item label="Select country" value="" />{COUNTRIES.map((country) => <Picker.Item key={country} label={country} value={country} />)}</Picker></View></View></View>
        <Text style={styles.label}>Description</Text><TextInput accessibilityLabel="Center description" value={form.description} onChangeText={(value) => set('description', value)} multiline placeholder="Tell divers what your center offers" style={[styles.input, styles.notes]} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={saving} style={[styles.button, saving && styles.disabled]} onPress={register}><Text style={styles.buttonText}>{saving ? 'Registering…' : 'Create center account'}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backText}>Back to login</Text></TouchableOpacity>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f8' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#ccdbe0', padding: 24 },
  eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#123b52', fontSize: 27, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#627687', marginTop: 7, lineHeight: 20 },
  label: { color: '#123b52', fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 5 },
  input: { width: '100%', minHeight: 46, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', backgroundColor: '#fff' },
  pickerWrap: { borderWidth: 1, borderColor: '#aabfc7', borderRadius: 11, backgroundColor: '#fff', overflow: 'hidden' },
  picker: { height: 46, width: '100%', color: '#334155' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  error: { color: '#b42318', marginTop: 12, textAlign: 'center' },
  button: { backgroundColor: '#123b52', borderRadius: 22, padding: 13, alignItems: 'center', marginTop: 20 },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  backButton: { alignItems: 'center', padding: 13, marginTop: 4 },
  backText: { color: '#0b777b', fontWeight: 'bold' },
});
