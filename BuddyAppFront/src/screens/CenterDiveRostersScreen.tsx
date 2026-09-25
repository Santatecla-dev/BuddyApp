import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { PlannedDiveRoster } from '../types';

const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function CenterDiveRostersScreen({ navigation }: any) {
  const [rosters, setRosters] = useState<PlannedDiveRoster[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<PlannedDiveRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await API.get<PlannedDiveRoster[]>('/planned-dives/rosters', { params: { search: query.trim() || undefined } });
      setRosters(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load dive center rosters.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const timer = setTimeout(() => { if (query.trim()) load(true); }, 280);
    return () => clearTimeout(timer);
  }, [query, load]);

  const requestPlace = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await API.post(`/planned-dives/${selected.id}/roster-request`, { message: message.trim() || undefined });
      setSelected(null);
      setMessage('');
      await load(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not request a place on this roster.');
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}><Text style={styles.eyebrow}>CENTER ROSTERS</Text><Text style={styles.title}>Find a dive to join</Text><Text style={styles.subtitle}>Browse upcoming departures from dive centers, even if you have never dived with them before.</Text></View>
        <View style={styles.heroBadge}><Text style={styles.heroValue}>{rosters.length}</Text><Text style={styles.heroLabel}>open rosters</Text></View>
      </View>
      <View style={styles.searchCard}><TextInput accessibilityLabel="Search center dive rosters" placeholder="Search center, city or dive site" placeholderTextColor="#7890a0" value={query} onChangeText={setQuery} style={styles.searchInput} /><Text style={styles.searchHint}>Only upcoming center-planned dives with available places are listed.</Text></View>
      {error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => load()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading dive center rosters" color="#123b52" style={styles.loader} /> : null}
      {!loading && !error && rosters.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No open rosters found</Text><Text style={styles.emptyText}>Try a different center, city or dive site.</Text></View> : null}
      <View style={styles.grid}>{rosters.map((roster) => {
        const joined = roster.roster?.joined || 0;
        const capacity = roster.roster?.capacity || roster.capacity || 12;
        const full = joined >= capacity;
        const status = roster.roster?.requestStatus;
        return <View key={roster.id} style={styles.card}>
          <View style={styles.cardHeader}><View style={styles.cardCopy}><Text style={styles.centerName}>{roster.center?.name || 'Dive center'}</Text><Text style={styles.centerMeta}>{[roster.center?.city, roster.center?.country].filter(Boolean).join(' · ')}</Text></View><Text style={styles.verified}>{roster.center?.verified ? 'VERIFIED' : 'CENTER'}</Text></View>
          <Text style={styles.date}>{dateLabel(roster.date)}</Text><Text style={styles.location}>{roster.location}</Text><Text style={styles.meta}>{roster.duration} min · {roster.maxDepth} m · {roster.gas}</Text>
          <View style={styles.rosterRow}><Text style={styles.rosterLabel}>Roster capacity</Text><Text style={[styles.rosterCount, full && styles.full]}>{joined}/{capacity} divers</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (joined / Math.max(1, capacity)) * 100)}%` }]} /></View>
          {status === 'PENDING' ? <Text style={styles.pending}>Request pending</Text> : status === 'ACCEPTED' ? <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('PlannedDives')} style={styles.joined}><Text style={styles.joinedText}>Joined · View planned dives</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" disabled={full} onPress={() => { setSelected(roster); setMessage(''); }} style={[styles.requestButton, full && styles.disabled]}><Text style={styles.requestText}>{full ? 'Roster full' : 'Request a place'}</Text></TouchableOpacity>}
        </View>;
      })}</View>
    </ScrollView>
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={styles.backdrop}><View style={styles.modal}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Request a place</Text><Text style={styles.modalHint}>{selected?.center?.name} · {selected?.location}</Text></View><TouchableOpacity accessibilityLabel="Close" onPress={() => setSelected(null)}><Text style={styles.close}>×</Text></TouchableOpacity></View><Text style={styles.label}>Message to the center (optional)</Text><TextInput accessibilityLabel="Roster request message" multiline placeholder="Tell the center about your experience or equipment needs" value={message} onChangeText={setMessage} style={styles.messageInput} /><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={requestPlace} style={[styles.confirmButton, saving && styles.disabled]}><Text style={styles.confirmText}>{saving ? 'Sending…' : 'Send request'}</Text></TouchableOpacity></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f8' }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 60 }, hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, backgroundColor: '#e1ebee', borderWidth: 1, borderColor: '#b9cdd3', borderRadius: 22, padding: 24 }, heroCopy: { flex: 1, minWidth: 260 }, eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 }, title: { color: '#123b52', fontSize: 29, fontWeight: 'bold', marginTop: 5 }, subtitle: { color: '#536b7a', lineHeight: 21, marginTop: 7 }, heroBadge: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, heroValue: { color: '#123b52', fontSize: 22, fontWeight: 'bold' }, heroLabel: { color: '#718394', fontSize: 10, marginTop: 2 }, searchCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 16, padding: 15, marginTop: 16 }, searchInput: { minHeight: 46, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 11, paddingHorizontal: 13, color: '#263f4d', fontSize: 15 }, searchHint: { color: '#718394', fontSize: 11, marginTop: 8 }, errorCard: { backgroundColor: '#fff3f2', borderWidth: 1, borderColor: '#efb7b2', borderRadius: 14, padding: 14, marginTop: 16 }, error: { color: '#b42318' }, retry: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#b42318', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 7, marginTop: 8 }, retryText: { color: '#b42318', fontWeight: 'bold' }, loader: { marginTop: 30 }, empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 28, alignItems: 'center', marginTop: 16 }, emptyTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold' }, emptyText: { color: '#718394', marginTop: 6 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }, card: { flexGrow: 1, flexBasis: 330, minWidth: 280, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 17 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, cardCopy: { flex: 1, minWidth: 0 }, centerName: { color: '#123b52', fontWeight: 'bold', fontSize: 16 }, centerMeta: { color: '#718394', fontSize: 11, marginTop: 3 }, verified: { color: '#0b777b', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.8 }, date: { color: '#0b777b', fontWeight: 'bold', fontSize: 12, marginTop: 17 }, location: { color: '#123b52', fontSize: 21, fontWeight: 'bold', marginTop: 6 }, meta: { color: '#536b7a', fontSize: 12, marginTop: 5 }, rosterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 17 }, rosterLabel: { color: '#718394', fontSize: 12 }, rosterCount: { color: '#123b52', fontWeight: 'bold', fontSize: 12 }, full: { color: '#b42318' }, progressTrack: { height: 7, backgroundColor: '#e7eef0', borderRadius: 5, overflow: 'hidden', marginTop: 7 }, progressFill: { height: '100%', backgroundColor: '#0b777b', borderRadius: 5 }, requestButton: { backgroundColor: '#123b52', borderRadius: 21, alignItems: 'center', padding: 12, marginTop: 17 }, requestText: { color: '#fff', fontWeight: 'bold' }, pending: { color: '#9a741b', backgroundColor: '#fff5d9', borderRadius: 18, padding: 10, textAlign: 'center', marginTop: 17, fontWeight: 'bold' }, joined: { backgroundColor: '#e4f2ee', borderRadius: 18, padding: 10, alignItems: 'center', marginTop: 17 }, joinedText: { color: '#176b5d', fontWeight: 'bold', fontSize: 12 }, disabled: { opacity: 0.5 }, backdrop: { flex: 1, backgroundColor: 'rgba(8,34,48,.48)', justifyContent: 'center', padding: 18 }, modal: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 19, padding: 20 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, modalTitle: { color: '#123b52', fontSize: 21, fontWeight: 'bold' }, modalHint: { color: '#718394', fontSize: 12, marginTop: 3 }, close: { color: '#536b7a', fontSize: 27 }, label: { color: '#123b52', fontSize: 12, fontWeight: 'bold', marginTop: 17, marginBottom: 6 }, messageInput: { minHeight: 110, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 11, padding: 12, color: '#263f4d', textAlignVertical: 'top' }, confirmButton: { backgroundColor: '#123b52', borderRadius: 21, alignItems: 'center', padding: 12, marginTop: 16 }, confirmText: { color: '#fff', fontWeight: 'bold' },
});
