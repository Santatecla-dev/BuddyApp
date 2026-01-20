import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import API from '../api/api';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('buddy@demo.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  const login = async () => {
    try {
      setError('');
      const res = await API.post('/auth/login', { email, password });
      const token = res.data.accessToken;
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      navigation.navigate('MyDives');
    } catch (err: any) {
      console.log('Error login:', err.response ? err.response.data : err.message);
      setError('Credenciales incorrectas');
    }
  };

  return (
    <View style={styles.container}>
      {/* LOGO */}
<Image
  source={{ uri: '/images/buddy.png' }} // 🔹 URL relativa a public
  style={styles.logo}
  resizeMode="contain"
/>

      <Text style={styles.label}>Email</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Contraseña</Text>
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={login}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.registerButton]}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.buttonText}>Registrarse</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },

  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 30,
  },

  label: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#0077CC',
  },

  input: {
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
    backgroundColor: '#00A8A8',
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  error: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
});
