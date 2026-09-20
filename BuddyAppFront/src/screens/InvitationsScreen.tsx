import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import API from '../api/api';
import { DiveInvite } from '../types';

type BuddyInviteGroup = {
  key: string;
  buddy: string;
  data: DiveInvite[];
};

export default function InvitationsScreen() {
  const [invites, setInvites] = useState<DiveInvite[]>([]);
  const [groupedByBuddy, setGroupedByBuddy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<number[]>([]);
  const inFlight = useRef(new Set<number>());

  const fetchInvites = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/dives/invites/pending');
      setInvites(res.data);
    } catch (err) {
      setError('Could not load invitations. Please try again.');
    } finally { setLoading(false); }
  };

  const respond = async (inviteId: number, accept: boolean) => {
    if (inFlight.current.has(inviteId)) return;
    inFlight.current.add(inviteId);
    setPending([...inFlight.current]);
    setError('');
    try {
      await API.post(`/dives/invite/${accept ? 'accept' : 'reject'}`, {
        inviteId,
      });
      setInvites(current => current.filter(invite => invite.id !== inviteId));
    } catch (err) {
      setError('Could not update the invitation. Please try again.');
    } finally {
      inFlight.current.delete(inviteId);
      setPending([...inFlight.current]);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const sections = useMemo((): BuddyInviteGroup[] => {
    if (!groupedByBuddy) return invites.length ? [{ key: 'all', buddy: '', data: invites }] : [];
    const groups = new Map<string, BuddyInviteGroup>();
    invites.forEach(invite => {
      const user = invite.invitedByUser;
      const key = String(user?.userId ?? user?.id ?? user?.email ?? `unknown-${invite.id}`);
      if (!groups.has(key)) groups.set(key, { key, buddy: user?.name || 'Unknown buddy', data: [] });
      groups.get(key)!.data.push(invite);
    });
    return [...groups.values()];
  }, [invites, groupedByBuddy]);

  const renderInviteCard = (item: DiveInvite) => (
    <View style={styles.card}>
      <Text style={styles.title}>
        {item.dive.location} ·{' '}
        {new Date(item.dive.date).toLocaleDateString('en-GB')}
      </Text>

      <Text style={styles.subtitle}>
        Invited by: {item.invitedByUser?.name || 'Unknown buddy'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button"
          style={[styles.button, styles.acceptButton, pending.includes(item.id) && { opacity: 0.6 }]}
          disabled={pending.includes(item.id)}
          accessibilityState={{ disabled: pending.includes(item.id), busy: pending.includes(item.id) }}
          onPress={() => respond(item.id, true)}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button"
          style={[styles.button, styles.rejectButton, pending.includes(item.id) && { opacity: 0.6 }]}
          disabled={pending.includes(item.id)}
          accessibilityState={{ disabled: pending.includes(item.id), busy: pending.includes(item.id) }}
          onPress={() => respond(item.id, false)}
        >
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {error ? <View style={styles.feedback}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.groupToggle} onPress={fetchInvites}><Text style={styles.buttonText}>Retry</Text></TouchableOpacity>
      </View> : null}
      <SectionList
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => renderInviteCard(item)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => section.buddy ? <View style={styles.groupHeader}>
          <Text accessibilityRole="header" style={styles.groupHeaderName}>{section.buddy}</Text>
          <Text style={styles.groupHeaderCount}>{section.data.length} invitation{section.data.length === 1 ? '' : 's'}</Text>
        </View> : null}
        ListHeaderComponent={
          <TouchableOpacity accessibilityRole="button"
            accessibilityState={{ expanded: groupedByBuddy }}
            style={styles.groupToggle}
            onPress={() => setGroupedByBuddy((value) => !value)}
          >
            <Text style={styles.groupToggleText}>
              {groupedByBuddy ? 'Show all' : 'Group by buddy'}
            </Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading invitations" color="#0077CC" /> : !error ?
          <Text style={styles.emptyText}>
            You have no pending invitations.
          </Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  feedback: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#dce3eb' },
  title: { color: '#243247', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#555', fontSize: 14, marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { flexGrow: 1, flexBasis: 100, minHeight: 48, padding: 12, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { backgroundColor: '#187442' },
  rejectButton: { backgroundColor: '#B42318' },
  buttonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  groupToggle: { alignSelf: 'flex-start', backgroundColor: '#0077CC', borderRadius: 22, padding: 14, minHeight: 48, marginBottom: 16 },
  groupToggleText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  groupHeader: { backgroundColor: '#f2f8ff', borderRadius: 14, padding: 14, marginBottom: 12 },
  groupHeaderName: { color: '#0077CC', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  groupHeaderCount: { color: '#555', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#555', marginTop: 32 },
  error: { color: '#B42318', marginBottom: 12 },
});
