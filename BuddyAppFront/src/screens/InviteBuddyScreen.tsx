import React, { useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import API from '../api/api';
import FormScreen from '../components/FormScreen';

export default function InviteBuddyScreen({ route }: any) {
  const { diveId } = route.params;
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  const inviteBuddy = async () => {
    if (inFlight.current) return;
    setError('');
    setSent(false);
    const id = Number(userId.trim());
    if (!/^\d+$/.test(userId.trim()) || !Number.isSafeInteger(id) || id <= 0) {
      setError('Enter a valid positive user ID.');
      return;
    }
    inFlight.current = true;
    setSending(true);
    try {
      await API.post('/dives/invite', { diveId, invitedUserId: id });
      setSent(true);
      setUserId('');
    } catch (err: any) {
      const message = String(err.response?.data?.message || '').toLowerCase();
      if (message.includes('ya está en la inmersión') || message.includes('already in')) {
        setError('This user is already in the dive.');
      } else if (message.includes('ya se ha enviado') || message.includes('already sent')) {
        setError('An invitation has already been sent to this user.');
      } else if (message.includes('not found') || message.includes('no encontrado')) {
        setError('No user was found with this ID.');
      } else {
        setError('Could not send the invitation. Please try again.');
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <FormScreen>
      <Text accessibilityRole="header" style={styles.title}>Invite a buddy</Text>
      <Text style={styles.label}>User ID</Text>
      <TextInput accessibilityLabel="User ID" placeholder="Enter your buddy’s user ID" placeholderTextColor="#596579"
        value={userId} onChangeText={value => { setUserId(value); setSent(false); setError(''); }}
        keyboardType="number-pad" style={styles.input} editable={!sending} onSubmitEditing={inviteBuddy} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {sent ? <Text accessibilityLiveRegion="polite" style={styles.success}>Invitation sent.</Text> : null}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: sending, busy: sending }}
        style={[styles.button, sending && { opacity: 0.6 }]} onPress={inviteBuddy} disabled={sending}>
        <Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send invitation'}</Text>
      </TouchableOpacity>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: 'bold', color: '#0077CC', textAlign: 'center', marginBottom: 12 },
  label: { color: '#333', fontWeight: 'bold' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#0077CC', backgroundColor: 'white', color: '#243247', fontSize: 16, padding: 14, borderRadius: 12 },
  error: { color: '#B42318', lineHeight: 22 },
  success: { color: '#187442', lineHeight: 22 },
  button: { minHeight: 48, backgroundColor: '#0077CC', padding: 15, borderRadius: 30, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
});
