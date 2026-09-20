import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import API from '../api/api';

export default function InviteBuddyScreen({ route }: any) {
  const { diveId } = route.params;
  const [userId, setUserId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [buttonText, setButtonText] = useState('Send invitation');
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [buttonSent, setButtonSent] = useState(false);

  const inviteBuddy = async () => {
    if (!userId.trim()) {
      setErrorMessage('Please enter a user ID');
      clearErrorAfterTimeout();
      return;
    }

    try {
      setButtonDisabled(true);
      await API.post('/dives/invite', {
        diveId,
        invitedUserId: parseInt(userId, 10),
      });

      setButtonText('Invitation sent');
      setButtonSent(true);
      setUserId('');

      setTimeout(() => {
        setButtonText('Send invitation');
        setButtonSent(false);
      }, 2000);
    } catch (err: any) {
      console.log(err);

      if (err.response?.status === 400) {
        const backendMsg = err.response.data.message || '';
        if (backendMsg.includes('El usuario ya está en la inmersión') || backendMsg.toLowerCase().includes('already in')) {
          setErrorMessage('User is already part of this dive');
        } else if (backendMsg.includes('Ya se ha enviado una invitación') || backendMsg.toLowerCase().includes('already sent')) {
          setErrorMessage('Invitation has already been sent');
        } else if (backendMsg.includes('user not found') || backendMsg.toLowerCase().includes('not found')) {
          setErrorMessage('User ID not found');
        } else {
          setErrorMessage('Error sending invitation');
        }
      } else {
        setErrorMessage('Error sending invitation');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Invite buddy</Text>

          <TextInput
            placeholder="User ID"
            value={userId}
            onChangeText={setUserId}
            keyboardType="numeric"
            style={styles.input}
            accessibilityLabel="User ID"
          />

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              buttonDisabled && { opacity: 0.6 },
              buttonSent && { backgroundColor: '#28A745' },
            ]}
            onPress={inviteBuddy}
            disabled={buttonDisabled}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
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

  content: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },

  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#0077CC',
  },

  input: {
    borderWidth: 1,
    borderColor: '#0077CC',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 14,
    fontSize: 16,
    color: '#333',
  },

  errorText: {
    color: '#D32F2F',
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },

  button: {
    backgroundColor: '#0077CC',
    paddingVertical: 15,
    paddingHorizontal: 20,
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
