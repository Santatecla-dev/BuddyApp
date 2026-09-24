import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { DiveTrip, Equipment, EquipmentPacking, EquipmentServiceRecord, PlannedDive } from '../types';

type Tab = 'overview' | 'maintenance' | 'packing';
type PackContext = { key: string; kind: 'trip' | 'planned'; id: number; label: string; detail: string };
type ServiceForm = { serviceDate: string; nextDueDate: string; serviceType: string; provider: string; cost: string; notes: string };

const EMPTY_SERVICE: ServiceForm = { serviceDate: '', nextDueDate: '', serviceType: 'Annual inspection', provider: '', cost: '', notes: '' };
const formatDate = (value?: string | null) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export default function EquipmentDetailScreen({ route, navigation }: any) {
  const equipmentId = Number(route?.params?.equipmentId);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [records, setRecords] = useState<EquipmentServiceRecord[]>([]);
  const [packs, setPacks] = useState<EquipmentPacking[]>([]);
  const [planned, setPlanned] = useState<PlannedDive[]>([]);
  const [trips, setTrips] = useState<DiveTrip[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [contextKey, setContextKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE);
  const [savingService, setSavingService] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [equipmentResponse, recordsResponse, packingResponse, plannedResponse, tripsResponse] = await Promise.all([
        API.get<Equipment>(`/equipment/${equipmentId}`),
        API.get<EquipmentServiceRecord[]>(`/equipment/${equipmentId}/service-records`),
        API.get<EquipmentPacking[]>(`/equipment/packing?equipmentId=${equipmentId}`),
        API.get<PlannedDive[]>('/planned-dives'),
        API.get<DiveTrip[]>('/dive-trips'),
      ]);
      setEquipment(equipmentResponse.data);
      setRecords(Array.isArray(recordsResponse.data) ? recordsResponse.data : []);
      setPacks(Array.isArray(packingResponse.data) ? packingResponse.data : []);
      setPlanned(Array.isArray(plannedResponse.data) ? plannedResponse.data : []);
      setTrips(Array.isArray(tripsResponse.data) ? tripsResponse.data : []);
    } catch {
      setError('We could not load this equipment.');
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useFocusEffect(useCallback(() => { loadDetail(); }, [loadDetail]));

  const contexts = useMemo<PackContext[]>(() => [
    ...trips.map((trip) => ({ key: `trip-${trip.id}`, kind: 'trip' as const, id: trip.id, label: trip.name, detail: `${trip.destination} · ${formatDate(trip.startDate)}` })),
    ...planned.filter((plan) => plan.status === 'upcoming').map((plan) => ({ key: `planned-${plan.id}`, kind: 'planned' as const, id: plan.id, label: plan.location, detail: `${plan.country} · ${formatDate(plan.date)}` })),
  ], [planned, trips]);

  const selectedContext = contexts.find((context) => context.key === contextKey) || contexts[0];
  const selectedPack = selectedContext ? packs.find((pack) => selectedContext.kind === 'trip' ? pack.tripId === selectedContext.id : pack.plannedDiveId === selectedContext.id) : undefined;

  const openServiceForm = () => {
    setServiceForm({ ...EMPTY_SERVICE, serviceDate: new Date().toISOString().slice(0, 10) });
    setServiceModal(true);
  };

  const saveService = async () => {
    if (!serviceForm.serviceDate || !serviceForm.serviceType.trim()) return;
    setSavingService(true);
    try {
      await API.post(`/equipment/${equipmentId}/service-records`, { serviceDate: serviceForm.serviceDate, nextDueDate: serviceForm.nextDueDate || undefined, serviceType: serviceForm.serviceType.trim(), provider: serviceForm.provider.trim() || undefined, cost: serviceForm.cost ? Number(serviceForm.cost) : undefined, notes: serviceForm.notes.trim() || undefined });
      setServiceModal(false);
      await loadDetail();
    } catch {
      setError('Could not save the service record.');
    } finally {
      setSavingService(false);
    }
  };

  const removeRecord = async (record: EquipmentServiceRecord) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('Remove this service record?')) return;
    try {
      await API.delete(`/equipment/service-records/${record.id}`);
      setRecords((current) => current.filter((candidate) => candidate.id !== record.id));
    } catch {
      setError('Could not remove the service record.');
    }
  };

  const addPackContext = async (context: PackContext) => {
    try {
      const payload = context.kind === 'trip' ? { equipmentId, tripId: context.id } : { equipmentId, plannedDiveId: context.id };
      const response = await API.post<EquipmentPacking>('/equipment/packing', payload);
      setPacks((current) => current.some((item) => item.id === response.data.id) ? current : [...current, response.data]);
      setContextKey(context.key);
    } catch {
      setError('Could not add this packing context.');
    }
  };

  const togglePack = async () => {
    if (!selectedContext) return;
    if (!selectedPack) {
      await addPackContext(selectedContext);
      return;
    }
    try {
      const response = await API.patch<EquipmentPacking>(`/equipment/packing/${selectedPack.id}`, { packed: !selectedPack.packed });
      setPacks((current) => current.map((item) => item.id === response.data.id ? response.data : item));
    } catch {
      setError('Could not update the packing status.');
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading equipment details" color="#0077CC" /></View>;
  if (error && !equipment) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={loadDetail}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>;
  if (!equipment) return null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}><TouchableOpacity accessibilityLabel="Back to equipment" onPress={() => navigation.goBack()}><Text style={styles.backText}>‹ Equipment</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.editButton} onPress={() => navigation.goBack()}><Text style={styles.editText}>Edit item</Text></TouchableOpacity></View>
        <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.eyebrow}>{equipment.category}</Text><Text style={styles.title}>{equipment.name}</Text><Text style={styles.subtitle}>{[equipment.brand, equipment.model].filter(Boolean).join(' ') || 'Brand and model not specified'}</Text></View><View style={styles.statusBadge}><Text style={styles.statusText}>{equipment.condition === 'service_due' ? 'Service due' : equipment.condition === 'retired' ? 'Retired' : 'Ready'}</Text></View></View>
        {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}
        <View style={styles.tabs}>{(['overview', 'maintenance', 'packing'] as Tab[]).map((value) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: tab === value }} key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value === 'overview' ? 'Overview' : value === 'maintenance' ? 'Maintenance' : 'Packing list'}</Text></TouchableOpacity>)}</View>

        {tab === 'overview' ? <View style={styles.panel}><View style={styles.infoGrid}><View style={styles.infoCell}><Text style={styles.infoLabel}>Next service</Text><Text style={styles.infoValue}>{formatDate(equipment.nextServiceDate)}</Text></View><View style={styles.infoCell}><Text style={styles.infoLabel}>Serial number</Text><Text style={styles.infoValue}>{equipment.serialNumber || 'Not specified'}</Text></View><View style={styles.infoCell}><Text style={styles.infoLabel}>Purchased</Text><Text style={styles.infoValue}>{formatDate(equipment.purchaseDate)}</Text></View></View><Text style={styles.panelTitle}>Notes</Text><Text style={styles.notes}>{equipment.notes || 'No notes for this item.'}</Text><View style={styles.usageCard}><Text style={styles.panelTitle}>Packing contexts</Text><Text style={styles.notes}>{packs.length ? `${packs.length} trip or dive context${packs.length === 1 ? '' : 's'} linked.` : 'This item has not been added to a packing list yet.'}</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => setTab('packing')}><Text style={styles.secondaryButtonText}>Manage packing</Text></TouchableOpacity></View></View> : null}

        {tab === 'maintenance' ? <View style={styles.panel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>Service history</Text><TouchableOpacity style={styles.primaryButton} onPress={openServiceForm}><Text style={styles.primaryButtonText}>+ Add service</Text></TouchableOpacity></View>{records.length ? records.map((record) => <View key={record.id} style={styles.recordCard}><View style={styles.recordHeader}><Text style={styles.recordType}>{record.serviceType}</Text><Text style={styles.recordDate}>{formatDate(record.serviceDate)}</Text></View><Text style={styles.recordMeta}>{record.provider || 'No provider'}{record.cost !== null && record.cost !== undefined ? ` · €${record.cost}` : ''}</Text><Text style={styles.recordNotes}>{record.notes || 'No notes added.'}</Text><View style={styles.recordFooter}><Text style={styles.nextDue}>Next due: {formatDate(record.nextDueDate)}</Text><TouchableOpacity accessibilityLabel={`Remove ${record.serviceType} record`} onPress={() => removeRecord(record)}><Text style={styles.deleteText}>Remove</Text></TouchableOpacity></View></View>) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No service history yet</Text><Text style={styles.emptyText}>Record inspections and repairs to keep your kit safe.</Text><TouchableOpacity style={styles.secondaryButton} onPress={openServiceForm}><Text style={styles.secondaryButtonText}>Add first record</Text></TouchableOpacity></View>}</View> : null}

        {tab === 'packing' ? <View style={styles.panel}><Text style={styles.panelTitle}>Add this item to a trip or dive</Text><Text style={styles.helper}>Choose a context to track whether this equipment is packed.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextRow}>{contexts.length ? contexts.map((context) => <TouchableOpacity key={context.key} style={[styles.contextChip, selectedContext?.key === context.key && styles.contextChipActive]} onPress={() => setContextKey(context.key)}><Text style={[styles.contextLabel, selectedContext?.key === context.key && styles.contextLabelActive]} numberOfLines={1}>{context.label}</Text><Text style={[styles.contextDetail, selectedContext?.key === context.key && styles.contextDetailActive]}>{context.detail}</Text></TouchableOpacity>) : <Text style={styles.emptyText}>Create a planned dive or trip first.</Text>}</ScrollView>{selectedContext ? <View style={styles.packPanel}><Text style={styles.packContextTitle}>{selectedContext.label}</Text><Text style={styles.notes}>{selectedContext.detail}</Text><TouchableOpacity style={[styles.packToggle, selectedPack?.packed && styles.packToggleActive]} onPress={togglePack}><Text style={[styles.packToggleText, selectedPack?.packed && styles.packToggleTextActive]}>{selectedPack?.packed ? '✓ Packed for this context' : selectedPack ? 'Mark as packed' : 'Add to packing list'}</Text></TouchableOpacity></View> : null}</View> : null}
      </ScrollView>

      <Modal visible={serviceModal} transparent animationType="slide" onRequestClose={() => setServiceModal(false)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ScrollView keyboardShouldPersistTaps="handled"><View style={styles.modalHeader}><Text style={styles.modalTitle}>Add service record</Text><TouchableOpacity accessibilityLabel="Close service form" onPress={() => setServiceModal(false)}><Text style={styles.closeText}>×</Text></TouchableOpacity></View><Text style={styles.fieldLabel}>Service date *</Text><TextInput value={serviceForm.serviceDate} onChangeText={(value) => setServiceForm((current) => ({ ...current, serviceDate: value }))} placeholder="YYYY-MM-DD" style={styles.input} /><Text style={styles.fieldLabel}>Service type *</Text><TextInput value={serviceForm.serviceType} onChangeText={(value) => setServiceForm((current) => ({ ...current, serviceType: value }))} placeholder="Annual inspection" style={styles.input} /><Text style={styles.fieldLabel}>Next due date</Text><TextInput value={serviceForm.nextDueDate} onChangeText={(value) => setServiceForm((current) => ({ ...current, nextDueDate: value }))} placeholder="YYYY-MM-DD" style={styles.input} /><View style={styles.formRow}><View style={styles.formHalf}><Text style={styles.fieldLabel}>Provider</Text><TextInput value={serviceForm.provider} onChangeText={(value) => setServiceForm((current) => ({ ...current, provider: value }))} placeholder="Dive centre" style={styles.input} /></View><View style={styles.formHalf}><Text style={styles.fieldLabel}>Cost</Text><TextInput value={serviceForm.cost} onChangeText={(value) => setServiceForm((current) => ({ ...current, cost: value }))} placeholder="0" keyboardType="decimal-pad" style={styles.input} /></View></View><Text style={styles.fieldLabel}>Notes</Text><TextInput value={serviceForm.notes} onChangeText={(value) => setServiceForm((current) => ({ ...current, notes: value }))} multiline placeholder="What was checked?" style={[styles.input, styles.notesInput]} /><View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => setServiceModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={savingService} style={[styles.primaryButton, savingService && styles.disabledButton]} onPress={saveService}><Text style={styles.primaryButtonText}>{savingService ? 'Saving…' : 'Save record'}</Text></TouchableOpacity></View></ScrollView></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 20, paddingBottom: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f7f9fc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backText: { color: '#0077CC', fontWeight: 'bold', fontSize: 14 },
  editButton: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  editText: { color: '#0077CC', fontWeight: 'bold', fontSize: 12 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 20, padding: 22 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#546c7b', marginTop: 5, fontSize: 15 },
  statusBadge: { borderRadius: 10, backgroundColor: '#e6f7f3', paddingHorizontal: 10, paddingVertical: 7, marginLeft: 12 },
  statusText: { color: '#008d78', fontSize: 11, fontWeight: 'bold' },
  inlineError: { color: '#b34b44', textAlign: 'center', marginTop: 12 },
  errorText: { color: '#b34b44', textAlign: 'center', fontWeight: '600' },
  retryButton: { marginTop: 14, borderWidth: 1, borderColor: '#b34b44', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9 },
  retryText: { color: '#b34b44', fontWeight: 'bold' },
  tabs: { flexDirection: 'row', gap: 7, borderBottomWidth: 1, borderBottomColor: '#dbe6ee', marginTop: 20, marginBottom: 16 },
  tab: { paddingHorizontal: 13, paddingVertical: 11, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#00A8A8' },
  tabText: { color: '#708492', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#0077CC', fontWeight: 'bold' },
  panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 17, padding: 18 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 23 },
  infoCell: { flex: 1, minWidth: 180, backgroundColor: '#f5fbfd', borderRadius: 11, padding: 12 },
  infoLabel: { color: '#6a7d8d', fontSize: 11, fontWeight: 'bold' },
  infoValue: { color: '#164c67', fontSize: 15, fontWeight: 'bold', marginTop: 5 },
  panelTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold' },
  notes: { color: '#657987', marginTop: 7, lineHeight: 20 },
  usageCard: { backgroundColor: '#f5fbfd', borderRadius: 13, padding: 14, marginTop: 22 },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#00A8A8', borderRadius: 19, paddingHorizontal: 14, paddingVertical: 9, marginTop: 14 },
  secondaryButtonText: { color: '#008d8d', fontWeight: 'bold', fontSize: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  primaryButton: { backgroundColor: '#0077CC', borderRadius: 19, paddingHorizontal: 14, paddingVertical: 10 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  recordCard: { borderWidth: 1, borderColor: '#e2edf2', borderRadius: 13, padding: 14, marginBottom: 10 },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  recordType: { color: '#164c67', fontSize: 15, fontWeight: 'bold', flex: 1 },
  recordDate: { color: '#008d8d', fontSize: 12, fontWeight: 'bold' },
  recordMeta: { color: '#6a7d8d', fontSize: 12, marginTop: 5 },
  recordNotes: { color: '#657987', marginTop: 9 },
  recordFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#edf1f3' },
  nextDue: { color: '#718592', fontSize: 12 },
  deleteText: { color: '#b34b44', fontSize: 12, fontWeight: 'bold' },
  emptyCard: { alignItems: 'center', padding: 26 },
  emptyTitle: { color: '#164c67', fontSize: 17, fontWeight: 'bold' },
  emptyText: { color: '#6a7d8d', textAlign: 'center', marginTop: 7 },
  helper: { color: '#6a7d8d', marginTop: 6 },
  contextRow: { gap: 9, paddingVertical: 15 },
  contextChip: { width: 180, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 12, padding: 11, backgroundColor: '#fff' },
  contextChipActive: { backgroundColor: '#e7f6fb', borderColor: '#0077CC' },
  contextLabel: { color: '#164c67', fontWeight: 'bold', fontSize: 13 },
  contextLabelActive: { color: '#0077CC' },
  contextDetail: { color: '#7890a0', fontSize: 11, marginTop: 5 },
  contextDetailActive: { color: '#008d8d' },
  packPanel: { borderRadius: 14, backgroundColor: '#f5fbfd', padding: 16 },
  packContextTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold' },
  packToggle: { alignSelf: 'flex-start', marginTop: 15, borderWidth: 1, borderColor: '#0077CC', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10 },
  packToggleActive: { backgroundColor: '#e6f7f3', borderColor: '#55c6ad' },
  packToggleText: { color: '#0077CC', fontWeight: 'bold' },
  packToggleTextActive: { color: '#008d78' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8, 34, 48, 0.48)', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 600, maxHeight: '92%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { color: '#164c67', fontSize: 21, fontWeight: 'bold' },
  closeText: { color: '#6e8794', fontSize: 27, lineHeight: 23 },
  fieldLabel: { color: '#0077CC', fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#334155', fontSize: 14 },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  notesInput: { minHeight: 78, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  cancelText: { color: '#637789', fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
});
