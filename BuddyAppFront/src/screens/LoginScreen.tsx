import React, { useRef, useState } from 'react';
import { TextInput, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import API from '../api/api';
import FormScreen from '../components/FormScreen';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('buddy@demo.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const login = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      setError('');
      const res = await API.post('/auth/login', { email, password });
      const token = res.data.accessToken;
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      navigation.reset({ index: 0, routes: [{ name: 'MyDives' }] });
    } catch (err: any) {
      console.log('Error login:', err.response ? err.response.data : err.message);
      setError('Could not sign in. Check your email and password and try again.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <FormScreen>
      {/* LOGO */}
      <Image
        source={require('../assets/Buddy.png')}
        accessibilityLabel="Buddy"
        style={styles.logo}
        resizeMode="contain"
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
        autoComplete="current-password"
        onSubmitEditing={login}
        placeholderTextColor="#596579"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <TouchableOpacity accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading, busy: loading }} style={[styles.button, loading && { opacity: 0.6 }]} onPress={login}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button"
        style={[styles.button, styles.registerButton]}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.buttonText}>Create account</Text>
      </TouchableOpacity>
    </FormScreen>
  );
}

const styles = StyleSheet.create({

  logo: {
    width: '100%',
    maxWidth: 240,
    height: 160,
    alignSelf: 'center',
    marginBottom: 12,
  },


  label: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#0077CC',
  },

  input: {
    color: '#243247',
    fontSize: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#0077CC',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  button: {
    backgroundColor: '#0077CC',
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

  registerButton: {
    backgroundColor: '#007F83',
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  error: {
    color: '#B42318',
    marginBottom: 10,
    textAlign: 'center',
  },
});
