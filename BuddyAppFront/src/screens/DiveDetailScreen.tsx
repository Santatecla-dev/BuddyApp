import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TextInput,
  Alert,
  Pressable,
  ScrollView, 
} from 'react-native';
import API from '../api/api';
import { countryLabel } from '../utils/countries';
import { DiveBuddy, Dive } from '../types';

export default function DiveDetailScreen({ route, navigation }: any) {
  const { diveId } = route.params;

  const [dive, setDive] = useState<Dive | null>(null);
  const [buddies, setBuddies] = useState<DiveBuddy[]>([]);
  const [myNotes, setMyNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');

  const fetchDive = async () => {
    setLoadError('');
    try {
      const res = await API.get(`/dives/my`);
      const myDive = res.data.find((d: Dive) => d.id === diveId);
      if (!myDive) {
        setLoadError('This dive is no longer available.');
        return;
      }
      setDive(myDive);

      const buddiesRes = await API.get(`/dives/${diveId}/buddies`);
      setBuddies(buddiesRes.data);

      try {
        const notesRes = await API.get(`/dives/${diveId}/personal-notes`);
        setMyNotes(notesRes.data.notes || '');
      } catch {}
    } catch (err) {
      setLoadError('Could not load the dive.');
    }
  };

  const extractMyUserId = () => {
    try {
      const authHeader = API.defaults.headers.common['Authorization'];
      if (typeof authHeader === 'string') {
        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        setMyUserId(payload.userId);
      }
    } catch (err) {
      console.log('No se pudo obtener userId', err);
    }
  };

  useEffect(() => {
    setDive(null);
    setBuddies([]);
    setMyNotes('');
    fetchDive();
    extractMyUserId();
  }, [diveId]);

  const saveMyNotes = async () => {
    try {
      setSavingNotes(true);
      await API.patch(`/dives/${diveId}/personal-notes`, { notes: myNotes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      console.error('Could not save notes.');
      if (Platform.OS === 'web') {
        window.alert('Error: Could not save notes.');
      } else {
        Alert.alert('Error', 'Could not save notes.');
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const confirmLeaveDive = () => {
    const title = 'Leave dive';
    const message = 'Are you sure you want to leave this dive?';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        leaveDive();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leaveDive },
        ]
      );
    }
  };

  const leaveDive = async () => {
    try {
      await API.patch(`/dives/${diveId}/leave`);
      navigation.navigate('MyDives', { removeDiveId: diveId });
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Error: Could not leave the dive.');
      } else {
        Alert.alert('Error', 'Could not leave the dive.');
      }
    }
  };

  if (!dive) {
    return (
      <View style={styles.container}>
        <Text accessibilityRole={loadError ? 'alert' : undefined} style={styles.loading}>{loadError || 'Loading dive…'}</Text>
        {loadError ? <TouchableOpacity accessibilityRole="button" style={styles.shareButton} onPress={fetchDive}><Text style={styles.shareButtonText}>Retry</Text></TouchableOpacity> : null}
      </View>
    );
  }

  return (
    
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {loadError ? <Text accessibilityRole="alert" style={{ color: '#B42318', marginBottom: 12 }}>{loadError}</Text> : null}
      {/* CARD PRINCIPAL */}
      <View style={styles.card}>
        <Text style={styles.country}>{countryLabel(dive.country)}</Text>

        {}
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{dive.location}</Text>

          <Pressable accessibilityRole="button" style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center', marginLeft: 12 }} onPress={confirmLeaveDive}>
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
        </View>

        {}
        <Text style={styles.date}>
          {new Date(dive.date).toLocaleDateString('en-GB')} ·{' '}
          {new Date(dive.date).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.shadow]}>
            <Text style={styles.statValue}>{dive.maxDepth} m</Text>
            <Text style={styles.statLabel}>Depth</Text>
          </View>

          <View style={[styles.statBox, styles.shadow]}>
            <Text style={styles.statValue}>{dive.duration} min</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        <TouchableOpacity accessibilityRole="button"
          style={styles.shareButton}
          onPress={() => navigation.navigate('InviteBuddy', { diveId })}
        >
          <Text style={styles.shareButtonText}>Share dive</Text>
        </TouchableOpacity>
      </View>

      {/* NOTAS */}
      {}
      <View style={[styles.notesCard, styles.shadow]}>
        <Text style={styles.sectionTitle}>Notes</Text>

        <TextInput
          accessibilityLabel="Personal notes"
          value={myNotes}
          onChangeText={value => { setMyNotes(value); setSaved(false); }}
          multiline
          style={styles.notesInput}
        />

        <TouchableOpacity accessibilityRole="button" disabled={savingNotes} accessibilityState={{ disabled: savingNotes, busy: savingNotes }} style={styles.saveButton} onPress={saveMyNotes}>
          <Text style={styles.saveButtonText}>
            {savingNotes ? 'Saving…' : saved ? 'Saved ✓' : 'Save notes'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* BUDDIES */}
      <Text style={styles.sectionTitle}>Buddies</Text>

      {}
      {buddies.map(item => {
          const isMe = item.userId === myUserId;

          return (
            <TouchableOpacity accessibilityRole="button"
              key={item.userId}
              onPress={() => {
                navigation.navigate('Profile', { userId: isMe ? undefined : item.userId });
              }}
              style={[
                styles.buddyCard,
                styles.shadow,
                isMe && styles.myBuddyCard,
              ]}
              activeOpacity={isMe ? 1 : 0.7}
            >
              <View style={styles.buddyRow}>
                <Text style={styles.buddyName}>{item.name}</Text>
                {isMe && <Text style={styles.meBadge}>You</Text>}
              </View>
              <Text style={styles.buddyEmail}>{item.email}</Text>
            </TouchableOpacity>
          );
        })}
        {buddies.length === 0 && (
          <Text style={styles.emptyText}>
            There are no buddies in this dive yet.
          </Text>
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  loading: { textAlign: 'center', marginTop: 40 },

  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 5 },
      android: { elevation: 5 },
    }),
  },

  shadow: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },

  country: { color: '#0077CC', fontWeight: 'bold' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', flexShrink: 1 }, 
  leaveText: { color: '#CC3B3B', fontWeight: '600' },
  date: { color: '#555', marginTop: 4, fontSize: 12 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  statBox: {
    flex: 1,
    backgroundColor: '#f2f8ff',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 120,
  },

  statValue: { fontSize: 20, fontWeight: 'bold', color: '#0077CC' },
  statLabel: { fontSize: 12 },

  shareButton: {
    marginTop: 20,
    backgroundColor: '#0077CC',
    padding: 14,
    borderRadius: 30,
    alignItems: 'center',
  },

  shareButtonText: { color: 'white', fontWeight: 'bold' },

  notesCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 5 },

  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
  },

  saveButton: {
    marginTop: 12,
    backgroundColor: '#007F83',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
  },

  saveButtonText: { color: 'white', fontWeight: 'bold' },

  buddyCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },

  myBuddyCard: {
    borderWidth: 2,
    borderColor: '#0077CC',
    backgroundColor: '#f2f8ff',
  },

  buddyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  buddyName: { flexShrink: 1, fontWeight: 'bold', fontSize: 15 },
  buddyEmail: { fontSize: 13, color: '#666' },

  meBadge: {
    backgroundColor: '#0077CC',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
  },

  emptyText: { textAlign: 'center', color: '#777', marginTop: 20, marginBottom: 30 },
});
