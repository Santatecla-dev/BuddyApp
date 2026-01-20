import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import API from '../api/api';

export default function InviteBuddyScreen({ route }: any) {
  const { diveId } = route.params;
  const [userId, setUserId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [buttonText, setButtonText] = useState('Enviar invitación');
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [buttonSent, setButtonSent] = useState(false); // estado para color

  const inviteBuddy = async () => {
    if (!userId.trim()) {
      setErrorMessage('Introduce un ID de usuario');
      clearErrorAfterTimeout();
      return;
    }

    try {
      setButtonDisabled(true);
      await API.post('/dives/invite', {
        diveId,
        invitedUserId: parseInt(userId),
      });

      setButtonText('Invitación enviada');
      setButtonSent(true);
      setUserId('');

      setTimeout(() => {
        setButtonText('Enviar invitación');
        setButtonSent(false);
      }, 2000);
    } catch (err: any) {
      console.log(err);

      if (err.response?.status === 400) {
        const backendMsg = err.response.data.message;
        if (backendMsg.includes('El usuario ya está en la inmersión')) {
          setErrorMessage('El usuario ya está en la inmersión');
        } else if (backendMsg.includes('Ya se ha enviado una invitación')) {
          setErrorMessage('Invitación ya ha sido enviada');
        } else if (backendMsg.includes('user not found')) {
          setErrorMessage('Código de usuario incorrecto');
        } else {
          setErrorMessage('Error al enviar la invitación');
        }
      } else {
        setErrorMessage('Error al enviar la invitación');
      }

      clearErrorAfterTimeout();
    } finally {
      setButtonDisabled(false);
    }
  };

  const clearErrorAfterTimeout = () => {
    setTimeout(() => setErrorMessage(''), 3000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invitar buddy</Text>

      <TextInput
        placeholder="ID del usuario"
        value={userId}
        onChangeText={setUserId}
        keyboardType="numeric"
        style={styles.input} // 🔹 ahora con fondo blanco y borde azul
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <TouchableOpacity
        style={[
          styles.button,
          buttonDisabled && { opacity: 0.6 },
          buttonSent && { backgroundColor: '#28A745' }, // verde al enviar
        ]}
        onPress={inviteBuddy}
        disabled={buttonDisabled}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },

  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },

  input: {
    borderWidth: 1,
    borderColor: '#0077CC', // 🔹 borde azul
    backgroundColor: 'white', // 🔹 fondo blanco
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },

  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },

  button: {
    backgroundColor: '#0077CC',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
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
});
