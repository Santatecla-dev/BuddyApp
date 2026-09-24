import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import API from '../api/api';
import { DiveCenter } from '../types';

type Props = {
  selectedCenterId: string;
  onSelect: (center: DiveCenter | null) => void;
  label?: string;
  hint?: string;
};

export default function CenterSearchField({ selectedCenterId, onSelect, label = 'Dive center (optional)', hint = 'Search by center name or city. Results are loaded as you type.' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiveCenter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await API.get<DiveCenter[]>('/dive-centers', { params: { search: normalized } });
        setResults(Array.isArray(response.data) ? response.data : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (center: DiveCenter) => { onSelect(center); setQuery(center.name); setResults([]); };
  const clear = () => { setQuery(''); onSelect(null); };

  return <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}><TextInput accessibilityLabel={label} value={query} onChangeText={(value) => { setQuery(value); if (selectedCenterId) onSelect(null); }} placeholder="Type at least 2 characters" placeholderTextColor="#7890a0" style={styles.input} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear dive center" onPress={clear} style={styles.clear}><Text style={styles.clearText}>×</Text></TouchableOpacity></View>
    <Text style={styles.hint}>{selectedCenterId ? 'Selected center will be linked after confirmation.' : hint}</Text>
    {loading ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : null}
    {!loading && query.trim().length >= 2 && !results.length && !selectedCenterId ? <Text style={styles.empty}>No matching dive centers.</Text> : null}
    {results.length ? <View style={styles.results}>{results.map((center) => <TouchableOpacity key={center.id} accessibilityRole="button" onPress={() => choose(center)} style={styles.result}><Text style={styles.resultName}>{center.name}</Text><Text style={styles.resultMeta}>{[center.city, center.country].filter(Boolean).join(' · ') || 'Location not provided'}</Text></TouchableOpacity>)}</View> : null}
  </View>;
}

const styles = StyleSheet.create({ wrapper: { marginTop: 14 }, label: { color: '#334155', fontSize: 13, fontWeight: 'bold', marginBottom: 7 }, inputRow: { flexDirection: 'row', alignItems: 'center' }, input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 11, color: '#334155', fontSize: 15 }, clear: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8f2f6', alignItems: 'center', justifyContent: 'center', marginLeft: -40, marginRight: 5 }, clearText: { color: '#557180', fontSize: 20, lineHeight: 21 }, hint: { color: '#718394', fontSize: 11, marginTop: 5 }, loader: { marginVertical: 7 }, empty: { color: '#718394', fontSize: 12, marginTop: 8 }, results: { marginTop: 7, borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' }, result: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf2f5' }, resultName: { color: '#164c67', fontWeight: 'bold' }, resultMeta: { color: '#718394', fontSize: 11, marginTop: 3 },
});
