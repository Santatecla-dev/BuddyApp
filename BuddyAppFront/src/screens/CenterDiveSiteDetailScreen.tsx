import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { DiveSite, PokedexSpecies } from '../types';

export default function CenterDiveSiteDetailScreen({ navigation, route }: any) {
  const siteId = route?.params?.siteId;
  const [site, setSite] = useState<DiveSite | null>(null);
  const [speciesCatalog, setSpeciesCatalog] = useState<PokedexSpecies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError(''); setSite(null);
    if (!siteId) { setError('No dive site was selected.'); setLoading(false); return; }
    try { const [response, speciesResponse] = await Promise.all([API.get<DiveSite>(`/center/dive-sites/${siteId}`), API.get<PokedexSpecies[]>('/pokedex/species').catch(() => ({ data: [] }))]); setSite(response.data); setSpeciesCatalog(Array.isArray(speciesResponse.data) ? speciesResponse.data : []); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Could not load this dive site.'); }
    finally { setLoading(false); }
  }, [siteId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <View style={styles.center}><ActivityIndicator color="#123b52" /></View>;
  if (!site) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error || 'Dive site not found.'}</Text><TouchableOpacity accessibilityRole="button" onPress={load} style={styles.secondary}><Text style={styles.secondaryText}>Retry</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('CenterDiveSites')} style={styles.secondary}><Text style={styles.secondaryText}>Back to dive sites map</Text></TouchableOpacity></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.hero}><Text style={styles.eyebrow}>DIVE ZONE PROFILE</Text><Text style={styles.title}>{site.name}</Text><Text style={styles.coordinates}>{site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.difficulty || 'Difficulty not set'}</Text><Text style={styles.description}>{site.description || 'No description has been added yet.'}</Text></View>
    <View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{site.minDepth ?? '?'}–{site.maxDepth ?? '?'} m</Text><Text style={styles.metricLabel}>depth range</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{site.routes?.length || 0}</Text><Text style={styles.metricLabel}>routes</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{site.typicalSightings?.length || 0}</Text><Text style={styles.metricLabel}>typical sightings</Text></View></View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Highlights</Text>{site.highlights?.length ? <View style={styles.tagRow}>{site.highlights.map((highlight) => <Text key={highlight} style={styles.tag}>{highlight}</Text>)}</View> : <Text style={styles.muted}>Add the signature features of this site.</Text>}</View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Typical sightings</Text>{site.typicalSightings?.length ? <View style={styles.tagRow}>{site.typicalSightings.map((sighting) => { const species = speciesCatalog.find((candidate) => candidate.key === sighting); return <Text key={sighting} style={styles.sighting}>{species?.name || sighting}</Text>; })}</View> : <Text style={styles.muted}>No sightings have been linked yet.</Text>}</View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Currents and conditions</Text><Text style={styles.body}>{site.currentInfo || 'No current notes have been added yet.'}</Text></View>
    <View style={styles.panel}><Text style={styles.panelTitle}>Routes</Text>{site.routes?.length ? site.routes.map((routeItem) => <View key={routeItem.name} style={styles.route}><Text style={styles.routeName}>{routeItem.name}</Text><Text style={styles.routeMeta}>{routeItem.points?.length || 0} waypoints{routeItem.notes ? ` · ${routeItem.notes}` : ''}</Text></View>) : <Text style={styles.muted}>No route has been drawn yet.</Text>}</View>
    <TouchableOpacity accessibilityRole="button" onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('CenterDiveSites')} style={styles.secondary}><Text style={styles.secondaryText}>Back to dive sites map</Text></TouchableOpacity>
  </ScrollView>;
}


const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#f3f6f8' }, content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, error: { color: '#b42318', textAlign: 'center' }, hero: { backgroundColor: '#e1ebee', borderWidth: 1, borderColor: '#b9cdd3', borderRadius: 22, padding: 24 }, eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.1 }, title: { color: '#123b52', fontSize: 30, fontWeight: 'bold', marginTop: 6 }, coordinates: { color: '#0b777b', fontSize: 12, marginTop: 8 }, description: { color: '#536b7a', lineHeight: 21, marginTop: 12 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }, metric: { flex: 1, minWidth: 150, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 15, padding: 15 }, metricValue: { color: '#123b52', fontSize: 19, fontWeight: 'bold' }, metricLabel: { color: '#718394', fontSize: 11, marginTop: 4 }, panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 18, marginTop: 16 }, panelTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }, tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tag: { color: '#0b777b', backgroundColor: '#e4f2ee', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, fontWeight: 'bold' }, sighting: { color: '#24566b', backgroundColor: '#e6eff2', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, fontWeight: 'bold' }, body: { color: '#536b7a', lineHeight: 20 }, route: { borderTopWidth: 1, borderTopColor: '#e5edf0', paddingVertical: 11 }, routeName: { color: '#123b52', fontWeight: 'bold' }, routeMeta: { color: '#718394', fontSize: 12, marginTop: 4 }, muted: { color: '#718394' }, secondary: { borderWidth: 1, borderColor: '#0b777b', borderRadius: 21, alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, marginTop: 18 }, secondaryText: { color: '#0b777b', fontWeight: 'bold' } });
