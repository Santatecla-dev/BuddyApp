import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import API from '../api/api';

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setLoading(true);
      await API.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (Platform.OS === 'web') {
        window.alert('Registration successful! You can now log in.');
      } else {
        Alert.alert('Registration successful', 'You can now log in');
      }
      navigation.goBack();
    } catch (err: any) {
      console.log(err);
      setError(
        err.response?.data?.message || 'Error registering user'
      );
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>User registration</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            accessibilityLabel="Full name"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            accessibilityLabel="Password"
          />

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={register}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {loading ? 'Registering…' : 'Register'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.centerLink} onPress={() => navigation.navigate('CenterRegister')}>
            <Text style={styles.centerLinkText}>Register as a dive center instead</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#0077CC',
  },

  label: {
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#0077CC',
    fontSize: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: '#0077CC',
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
    fontSize: 16,
    color: '#333',
  },

  button: {
    backgroundColor: '#00A8A8',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  centerLink: { alignItems: 'center', padding: 12, marginTop: 3 },
  centerLinkText: { color: '#008d8d', fontWeight: 'bold', fontSize: 13 },

  error: {
    color: '#D32F2F',
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
