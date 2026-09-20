import React, { useState } from 'react';
import { TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import API from '../api/api';
import FormScreen from '../components/FormScreen';

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (loading) return;
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Complete all fields.');
      return;
    }

    try {
      setLoading(true);
      await API.post('/auth/register', { name: name.trim(), email: email.trim(), password });
      Alert.alert('Registration successful', 'You can now sign in.');
      navigation.goBack(); // vuelve al login
    } catch (err: any) {
      console.log(err);
      setError('Could not create your account. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen>
      <Text style={styles.title}>Create account</Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        accessibilityLabel="Full name"
        autoComplete="name"
        placeholderTextColor="#596579"
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        accessibilityLabel="Email"
        autoComplete="email"
        placeholderTextColor="#596579"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        accessibilityLabel="Password"
        autoComplete="new-password"
        placeholderTextColor="#596579"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <TouchableOpacity accessibilityRole="button"
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={register}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create account'}</Text>
      </TouchableOpacity>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { color: '#243247', backgroundColor: 'white', fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: '#0077CC', padding: 12, borderRadius: 8, marginBottom: 10 },
  label: { color: '#0077CC', fontWeight: 'bold' },
  button: { backgroundColor: '#007F83', padding: 15, borderRadius: 25, alignItems: 'center', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  error: { color: '#B42318', marginBottom: 10, textAlign: 'center' },
});
