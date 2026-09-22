import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
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
      setError('Invalid credentials');
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
          {/* LOGO */}
          <Image
            source={require('../assets/Buddy.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Buddy App Logo"
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
            style={styles.button}
            onPress={login}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.registerButton]}
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Register</Text>
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

  logo: {
    width: 240,
    maxWidth: '80%',
    height: 140,
    alignSelf: 'center',
    marginBottom: 24,
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
    color: '#D32F2F',
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
