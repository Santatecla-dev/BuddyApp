import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { CenterInventoryItem, CenterWarehouse, WarehouseObject, WarehouseObjectType } from '../types';

import { DEFAULT_SIZES, findPlacement, fitsMap, isStorage, placementError, rotatedFootprint } from '../utils/warehouseLayout';

const CELL = 28;
const confirmAction = (message: string): Promise<boolean> => Platform.OS === 'web'
  ? Promise.resolve(window.confirm(message))
  : new Promise(resolve => Alert.alert('Confirm change', message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Confirm', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
const messageFor = (err: any, fallback: string) => {
  const message = err?.response?.data?.message;
  return typeof message === 'string' ? message : Array.isArray(message) ? message.join(' ') : fallback;
};
const OBJECT_TYPES: Array<{ type: WarehouseObjectType; label: string; color: string }> = [
  { type: 'rack', label: 'Rack', color: '#123b52' },
  { type: 'shelf', label: 'Shelf', color: '#0b777b' },
  { type: 'workbench', label: 'Workbench', color: '#7b5a1d' },
  { type: 'zone', label: 'Free zone', color: '#5c6f7b' },
  { type: 'compressor', label: 'Compressor', color: '#7a3d47' },
];
const titleFor = (type: WarehouseObjectType) => OBJECT_TYPES.find((item) => item.type === type)?.label || 'Object';
const ROTATABLE_TYPES: WarehouseObjectType[] = ['rack', 'shelf', 'workbench'];
export default function CenterWarehouseScreen() {
  const [data, setData] = useState<CenterWarehouse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [mapSettings, setMapSettings] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapWidth, setMapWidth] = useState('24');
  const [mapHeight, setMapHeight] = useState('16');
  const [query, setQuery] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const loadVersion = useRef(0);
  const [labelDraft, setLabelDraft] = useState('');
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setError('');
    try {
      const response = await API.get<CenterWarehouse>('/center/warehouse');
      if (version !== loadVersion.current) return;
      setData(response.data); setMapName(response.data.map.name);
      setMapWidth(String(response.data.map.width)); setMapHeight(String(response.data.map.height));
      setSelectedId(null); setModal(false); setMapSettings(false);
    } catch (err) {
      if (version === loadVersion.current) setError(messageFor(err, 'Could not load the warehouse map.'));
    } finally { if (version === loadVersion.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { loadVersion.current++; }; }, [load]));
  const selected = data?.objects.find(object => object.id === selectedId) || null;
  const selectObject = (object: WarehouseObject) => {
    if (busy.current) return;
    setSelectedId(object.id); setLabelDraft(object.label); setError('');
  };
  const unitCounts = useMemo(() => {
    const counts = new Map<number, number>();
    data?.inventory.forEach(item => {
      if (item.warehouseObjectId != null) counts.set(item.warehouseObjectId, (counts.get(item.warehouseObjectId) || 0) + item.quantity);
    });
    return counts;
  }, [data?.inventory]);
  const selectedInventory = useMemo(() => selectedId == null ? [] : data?.inventory.filter(item => item.warehouseObjectId === selectedId) || [], [data?.inventory, selectedId]);
  const filteredInventory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data?.inventory.filter(item =>
      (!selected || isStorage(selected.type) || item.warehouseObjectId === selectedId)
      && (!showUnassignedOnly || item.warehouseObjectId == null)
      && (!normalized || `${item.name} ${item.category}`.toLowerCase().includes(normalized))) || [];
  }, [data?.inventory, selected, selectedId, query, showUnassignedOnly]);
  // The ref closes the gap before React renders the disabled controls.
  const mutate = async (work: () => Promise<void>, fallback: string) => {
    if (busy.current || loading) return;
    busy.current = true; setSaving(true); setError('');
    try { await work(); } catch (err) { setError(messageFor(err, fallback)); }
    finally { busy.current = false; setSaving(false); }
  };
  const addObject = (type: WarehouseObjectType) => {
    if (!data) return;
    const placement = findPlacement(DEFAULT_SIZES[type], data.map, data.objects);
    if (!placement) { setError('There is no free space for this object. Move or resize existing objects, or enlarge the map.'); return; }
    const definition = OBJECT_TYPES.find(item => item.type === type)!;
    let suffix = 1;
    while (data.objects.some(item => item.label === `${definition.label} ${suffix}`)) suffix++;
    void mutate(async () => {
      const response = await API.post<WarehouseObject>('/center/warehouse/objects', {
        type, label: `${definition.label} ${suffix}`, color: definition.color, ...placement,
      });
      setData(current => current ? { ...current, objects: [...current.objects, response.data] } : current);
      setSelectedId(response.data.id); setLabelDraft(response.data.label);
    }, 'Could not add this warehouse object.');
  };
  const patchObject = (changes: Partial<WarehouseObject>) => {
    if (!selected || !data) return;
    const candidate = { ...selected, ...changes };
    if (selected.type === 'compressor' && (changes.width != null || changes.height != null)) {
      candidate.width = candidate.height = changes.width ?? changes.height!;
      changes = { ...changes, width: candidate.width, height: candidate.height };
    }
    const problem = placementError(candidate, data.map, data.objects);
    if (problem) { setError(problem); return; }
    if (candidate.width > 24 || candidate.height > 16) { setError('Objects can be at most 24 × 16 squares (compressors: 16 × 16).'); return; }
    void mutate(async () => {
      const response = await API.patch<WarehouseObject>(`/center/warehouse/objects/${selected.id}`, changes);
      setData(current => current ? { ...current, objects: current.objects.map(object => object.id === selected.id ? response.data : object) } : current);
      setLabelDraft(response.data.label);
    }, 'Could not update the selected object.');
  };
  const move = (dx: number, dy: number) => {
    if (selected) patchObject({ x: selected.x + dx, y: selected.y + dy });
  };
  const remove = () => {
    if (!selected) return;
    void mutate(async () => {
      if (!await confirmAction(`Remove ${selected.label}? Its inventory will become unassigned.`)) return;
      await API.delete(`/center/warehouse/objects/${selected.id}`);
      setData(current => current ? { ...current, objects: current.objects.filter(object => object.id !== selected.id),
        inventory: current.inventory.map(item => item.warehouseObjectId === selected.id ? { ...item, warehouseObjectId: null } : item) } : current);
      setSelectedId(null); setModal(false);
    }, 'Could not remove this warehouse object.');
  };
  const rotate = () => { if (selected && ROTATABLE_TYPES.includes(selected.type)) patchObject({ rotation: ((selected.rotation || 0) + 45) % 360 }); };
  const clearAll = () => {
    void mutate(async () => {
      if (!await confirmAction('Delete every object from this warehouse map? Inventory items will become unassigned.')) return;
      await API.delete('/center/warehouse/objects');
      setData(current => current ? { ...current, objects: [], inventory: current.inventory.map(item => ({ ...item, warehouseObjectId: null })) } : current);
      setSelectedId(null); setModal(false);
    }, 'Could not clear the warehouse map.');
  };
  const assign = (item: CenterInventoryItem) => {
    if (!selected || !data) return;
    const warehouseObjectId = item.warehouseObjectId === selected.id ? null : selected.id;
    if (warehouseObjectId !== null && !isStorage(selected.type)) { setError('Free zones and compressors cannot store inventory. Choose a rack, shelf or workbench.'); return; }
    void mutate(async () => {
      if (warehouseObjectId !== null && item.warehouseObjectId != null) {
        const source = data.objects.find(object => object.id === item.warehouseObjectId)?.label || 'another object';
        if (!await confirmAction(`Move all ${item.quantity} units of ${item.name} from ${source} to ${selected.label}?`)) return;
      }
      await API.patch(`/center/inventory/${item.id}`, { warehouseObjectId });
      setData(current => current ? { ...current, inventory: current.inventory.map(candidate => candidate.id === item.id ? { ...candidate, warehouseObjectId } : candidate) } : current);
    }, 'Could not update this inventory location.');
  };
  const saveMapSettings = () => {
    if (!data) return;
    const width = Number(mapWidth), height = Number(mapHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 6 || height < 6 || width > 80 || height > 60) {
      setError('Width must be 6–80 and height 6–60 whole squares.'); return;
    }
    if (data.objects.some(object => !fitsMap(object, { width, height }))) {
      setError('These dimensions would cut off placed objects. Move or resize them first.'); return;
    }
    void mutate(async () => {
      const response = await API.patch('/center/warehouse', { name: mapName.trim() || 'Main warehouse', width, height });
      setData(current => current ? { ...current, map: response.data } : current); setMapSettings(false);
    }, 'Could not save the warehouse dimensions.');
  };
  if (loading && !data) return <View style={styles.center}><ActivityIndicator color="#123b52" /><Text style={styles.loading}>Loading warehouse map…</Text></View>;
  if (!data) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity disabled={saving} accessibilityRole="button" style={styles.retry} onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>;
  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.eyebrow}>CENTER OPERATIONS</Text><Text style={styles.title}>Warehouse layout</Text><Text style={styles.subtitle}>Design your storage floor, then open a rack to see the inventory assigned to it.</Text></View><View style={styles.mapBadge}><Text style={styles.mapBadgeValue}>{data.objects.length}</Text><Text style={styles.mapBadgeLabel}>map objects</Text></View></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}><Text style={{ color: '#536b7a', fontSize: 11 }}>Layout tools</Text><TouchableOpacity disabled={saving} accessibilityRole="button" style={{ borderWidth: 1, borderColor: '#b42318', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }} onPress={clearAll}><Text style={{ color: '#b42318', fontSize: 12, fontWeight: 'bold' }}>Delete all objects</Text></TouchableOpacity></View>
    <View style={styles.toolbar}><Text style={styles.toolbarTitle}>Add to the map</Text><View style={styles.toolRow}>{OBJECT_TYPES.map((item) => <TouchableOpacity key={item.type} accessibilityRole="button" style={[styles.toolButton, { borderColor: item.color }]} disabled={saving} onPress={() => addObject(item.type)}><Text style={[styles.toolText, { color: item.color }]}>+ {item.label}</Text></TouchableOpacity>)}</View></View>
    <View style={styles.mapPanel}><View style={styles.mapHeader}><View style={{ minWidth: 0, maxWidth: '100%' }}><Text style={styles.sectionTitle}>{data.map.name}</Text><Text style={styles.sectionHint}>{data.map.width} × {data.map.height} squares · Select an object to edit it.</Text></View><View style={styles.mapHeaderActions}><Text style={styles.legend}>BLUEPRINT</Text><TouchableOpacity disabled={saving} accessibilityRole="button" style={styles.settingsButton} onPress={() => { setError(''); setMapName(data.map.name); setMapWidth(String(data.map.width)); setMapHeight(String(data.map.height)); setMapSettings(true); }}><Text style={styles.settingsText}>Edit map</Text></TouchableOpacity></View></View><ScrollView style={styles.mapViewport} nestedScrollEnabled showsVerticalScrollIndicator><ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator contentContainerStyle={styles.mapScroll}><View style={[styles.map, { width: data.map.width * CELL, height: data.map.height * CELL, overflow: 'visible' }]}>{Array.from({ length: data.map.width + 1 }, (_, x) => <View pointerEvents="none" key={`x${x}`} style={{ position: 'absolute', left: x * CELL, top: 0, bottom: 0, borderLeftWidth: 1, borderColor: '#dbe7ea' }} />)}
      {Array.from({ length: data.map.height + 1 }, (_, y) => <View pointerEvents="none" key={`y${y}`} style={{ position: 'absolute', top: y * CELL, left: 0, right: 0, borderTopWidth: 1, borderColor: '#dbe7ea' }} />)}
      {data.objects.map(object => {
        const footprint = rotatedFootprint(object);
        return <TouchableOpacity key={object.id} accessibilityRole="button"
          accessibilityLabel={`${object.label}, ${titleFor(object.type)}, ${unitCounts.get(object.id) || 0} units`}
          accessibilityState={{ selected: selectedId === object.id }} disabled={saving}
          onPress={() => selectObject(object)} style={[styles.mapObject, {
            left: (object.x + (footprint.width - object.width) / 2) * CELL + 2,
            top: (object.y + (footprint.height - object.height) / 2) * CELL + 2,
            width: object.width * CELL - 4, height: object.height * CELL - 4,
            backgroundColor: object.color, transform: [{ rotate: `${object.rotation || 0}deg` }],
          }, selectedId === object.id && styles.mapObjectSelected]}>
          <Text numberOfLines={2} style={styles.mapObjectLabel}>{object.label}</Text>
          <Text numberOfLines={1} style={styles.mapObjectCount}>{isStorage(object.type) ? `${unitCounts.get(object.id) || 0} units` : titleFor(object.type)}</Text>
        </TouchableOpacity>;
      })}</View></ScrollView></ScrollView></View>
    <Text style={styles.sectionHint}>Scroll the canvas horizontally and vertically to explore the entire map.</Text>
    <View style={styles.toolbar}><Text style={styles.toolbarTitle}>Select an object ({data.objects.length})</Text><Text style={styles.sectionHint}>All objects remain accessible here, including overlapping objects in older layouts.</Text><View style={styles.toolRow}>{data.objects.map(object => <TouchableOpacity key={object.id} accessibilityRole="button" accessibilityState={{ selected: selectedId === object.id }} disabled={saving} style={[styles.toolButton, selectedId === object.id && { backgroundColor: '#e1ebee' }]} onPress={() => selectObject(object)}><Text style={styles.toolText}>{object.label}</Text></TouchableOpacity>)}</View></View>
    {selected ? <View style={styles.editor}>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<View style={styles.editorHeader}><View style={styles.editorCopy}><Text style={styles.sectionTitle}>{selected.label}</Text><Text style={styles.sectionHint}>{titleFor(selected.type)} · {selected.width} × {selected.height} squares · {selected.rotation || 0}°</Text></View><TouchableOpacity disabled={saving} accessibilityRole="button" onPress={remove}><Text style={styles.delete}>Remove</Text></TouchableOpacity></View><Text style={styles.label}>Label</Text><TextInput accessibilityLabel="Warehouse object label" value={labelDraft} onChangeText={setLabelDraft} editable={!saving} maxLength={120} style={styles.input} /><TouchableOpacity accessibilityRole="button" disabled={saving || !labelDraft.trim() || labelDraft.trim() === selected.label} style={styles.settingsButton} onPress={() => patchObject({ label: labelDraft.trim() })}><Text style={styles.settingsText}>Save label</Text></TouchableOpacity><View style={styles.controls}><View><Text style={styles.controlLabel}>Position</Text><View style={styles.arrowGrid}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Move up" disabled={saving} onPress={() => move(0, -1)} style={styles.arrow}><Text style={styles.arrowText}>↑</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Move left" disabled={saving} onPress={() => move(-1, 0)} style={styles.arrow}><Text style={styles.arrowText}>←</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Move right" disabled={saving} onPress={() => move(1, 0)} style={styles.arrow}><Text style={styles.arrowText}>→</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Move down" disabled={saving} onPress={() => move(0, 1)} style={styles.arrow}><Text style={styles.arrowText}>↓</Text></TouchableOpacity></View></View><View style={{ minWidth: 0, maxWidth: '100%' }}><Text style={styles.controlLabel}>Size & orientation</Text><View style={styles.sizeButtons}><TouchableOpacity disabled={saving} accessibilityRole="button" style={styles.sizeButton} onPress={() => patchObject({ width: Math.max(1, selected.width - 1) })}><Text style={styles.sizeText}>− width</Text></TouchableOpacity><TouchableOpacity disabled={saving} accessibilityRole="button" style={styles.sizeButton} onPress={() => patchObject({ width: selected.width + 1 })}><Text style={styles.sizeText}>+ width</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.sizeButton} onPress={() => patchObject({ height: Math.max(1, selected.height - 1) })}><Text style={styles.sizeText}>− height</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.sizeButton} onPress={() => patchObject({ height: selected.height + 1 })}><Text style={styles.sizeText}>+ height</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving || !ROTATABLE_TYPES.includes(selected.type)} style={[styles.sizeButton, !ROTATABLE_TYPES.includes(selected.type) && { opacity: 0.45 }]} onPress={rotate}><Text style={styles.sizeText}>Rotate 45°</Text></TouchableOpacity></View></View></View>{!isStorage(selected.type) ? <Text style={styles.dimensionHint}>This {titleFor(selected.type).toLowerCase()} is not a storage location. Assign gear to a rack, shelf or workbench.</Text> : null}
      {isStorage(selected.type) || selectedInventory.length > 0 ? <TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.assignButton} onPress={() => { setError(''); setQuery(''); setShowUnassignedOnly(false); setModal(true); }}><Text style={styles.assignButtonText}>{isStorage(selected.type) ? 'Manage assigned inventory' : 'Remove invalid assignments'} ({unitCounts.get(selected.id) || 0} units)</Text></TouchableOpacity> : null}</View> : <View style={styles.empty}><Text style={styles.emptyTitle}>Select a warehouse object</Text><Text style={styles.emptyText}>Select an object on the map or in the list to edit it.</Text></View>}

  </ScrollView>
  <Modal visible={modal} transparent animationType="slide" onRequestClose={() => { if (!busy.current) setModal(false); }}><View style={styles.backdrop}><View style={styles.modal}><View style={styles.modalHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.modalTitle}>Assign inventory</Text><Text style={styles.modalHint}>{selected?.label || 'Selected object'}</Text></View><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="Close inventory" onPress={() => setModal(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View><TextInput accessibilityLabel="Search warehouse inventory" placeholder="Search equipment" value={query} onChangeText={setQuery} style={styles.input} />{selected && isStorage(selected.type) ? <TouchableOpacity disabled={saving} accessibilityRole="switch" accessibilityState={{ checked: showUnassignedOnly }} onPress={() => setShowUnassignedOnly((value) => !value)} style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: '#aabfc7', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, marginTop: 12 }}><Text style={{ color: '#0b777b', fontSize: 11, fontWeight: 'bold' }}>{showUnassignedOnly ? 'Showing unassigned only' : 'Filter unassigned inventory'}</Text></TouchableOpacity> : null}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<ScrollView style={styles.inventoryList} keyboardShouldPersistTaps="handled">{filteredInventory.length === 0 ? <Text style={styles.dimensionHint}>No inventory matches this view.</Text> : null}{filteredInventory.map((item) => <TouchableOpacity disabled={saving} key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: item.warehouseObjectId === selectedId }} onPress={() => assign(item)} style={[styles.inventoryRow, item.warehouseObjectId === selectedId && styles.inventoryRowActive]}><View style={styles.inventoryCheck}><Text style={styles.inventoryCheckText}>{item.warehouseObjectId === selectedId ? '✓' : ''}</Text></View><View style={styles.inventoryCopy}><Text style={styles.inventoryName}>{item.name}</Text><Text style={styles.inventoryMeta}>{item.category} · {item.quantity} unit{item.quantity === 1 ? '' : 's'}{item.warehouseObjectId && item.warehouseObjectId !== selectedId ? ` · Assigned to ${data.objects.find(object => object.id === item.warehouseObjectId)?.label || 'another object'}` : ''}</Text></View></TouchableOpacity>)}</ScrollView><TouchableOpacity disabled={saving} accessibilityRole="button" style={styles.doneButton} onPress={() => setModal(false)}><Text style={styles.doneText}>Done</Text></TouchableOpacity></View></View></Modal>
  <Modal visible={mapSettings} transparent animationType="slide" onRequestClose={() => { if (!busy.current) setMapSettings(false); }}><View style={styles.backdrop}><View style={styles.modal}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Warehouse canvas</Text><Text style={styles.modalHint}>Resize the grid without cutting off placed objects.</Text></View><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="Close map settings" onPress={() => setMapSettings(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View><Text style={styles.label}>Map name</Text><TextInput accessibilityLabel="Warehouse map name" value={mapName} onChangeText={setMapName} style={styles.input} /><View style={styles.dimensionRow}><View style={styles.dimensionField}><Text style={styles.label}>Width (squares)</Text><TextInput accessibilityLabel="Warehouse map width" keyboardType="number-pad" value={mapWidth} onChangeText={setMapWidth} style={styles.input} /></View><View style={styles.dimensionField}><Text style={styles.label}>Height (squares)</Text><TextInput accessibilityLabel="Warehouse map height" keyboardType="number-pad" value={mapHeight} onChangeText={setMapHeight} style={styles.input} /></View></View>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Text style={styles.dimensionHint}>Larger maps can be explored using horizontal and vertical scrolling.</Text><TouchableOpacity disabled={saving} accessibilityRole="button" style={styles.doneButton} onPress={saveMapSettings}><Text style={styles.doneText}>Save canvas</Text></TouchableOpacity></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f8' }, content: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 20, paddingBottom: 60 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, loading: { color: '#536b7a', marginTop: 10 }, error: { color: '#b42318', marginTop: 12 }, retry: { borderWidth: 1, borderColor: '#123b52', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 }, retryText: { color: '#123b52', fontWeight: 'bold' }, hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, backgroundColor: '#e1ebee', borderWidth: 1, borderColor: '#b9cdd3', borderRadius: 22, padding: 24 }, heroCopy: { flex: 1, minWidth: 0, flexBasis: 240 }, eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 }, title: { color: '#123b52', fontSize: 29, fontWeight: 'bold', marginTop: 5 }, subtitle: { color: '#536b7a', lineHeight: 21, marginTop: 7 }, mapBadge: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, mapBadgeValue: { color: '#123b52', fontSize: 22, fontWeight: 'bold' }, mapBadgeLabel: { color: '#536b7a', fontSize: 10, marginTop: 2 }, toolbar: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 16, padding: 15, marginTop: 16 }, toolbarTitle: { color: '#123b52', fontWeight: 'bold' }, toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, toolButton: { maxWidth: '100%', minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, toolText: { color: '#123b52', fontSize: 12, fontWeight: 'bold' }, mapPanel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 16, marginTop: 16 }, mapHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, mapHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, settingsButton: { borderWidth: 1, borderColor: '#0b777b', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 }, settingsText: { color: '#0b777b', fontSize: 11, fontWeight: 'bold' }, sectionTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold' }, sectionHint: { color: '#536b7a', fontSize: 12, marginTop: 4 }, legend: { color: '#0b777b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 }, mapViewport: { maxHeight: 520, marginTop: 12 }, mapScroll: { padding: 14 }, map: { flexDirection: 'row', flexWrap: 'wrap', position: 'relative', backgroundColor: '#f7fafb' }, gridCell: { width: CELL, height: CELL, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#dbe7ea' }, mapObject: { overflow: 'hidden', position: 'absolute', borderRadius: 7, padding: 5, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,.8)' }, mapObjectSelected: { borderColor: '#f3bb4b', borderWidth: 3, shadowColor: '#123b52', shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }, mapObjectLabel: { color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }, mapObjectCount: { color: '#e7f3f5', fontSize: 9, marginTop: 2 }, editor: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 18, marginTop: 16 }, editorHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, editorCopy: { flex: 1 }, delete: { color: '#b42318', fontWeight: 'bold' }, label: { color: '#123b52', fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 6 }, input: { minHeight: 45, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#263f4d', backgroundColor: '#fff' }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }, controlLabel: { color: '#536b7a', fontSize: 11, fontWeight: 'bold', marginBottom: 6 }, arrowGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 150, gap: 5 }, arrow: { width: 44, height: 44, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: '#123b52', fontSize: 19 }, sizeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, sizeButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#aabfc7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 }, sizeText: { color: '#0b777b', fontSize: 11, fontWeight: 'bold' }, dimensionRow: { flexDirection: 'row', gap: 10 }, dimensionField: { flex: 1, minWidth: 0 }, dimensionHint: { color: '#536b7a', fontSize: 11, lineHeight: 17, marginTop: 10 }, assignButton: { backgroundColor: '#123b52', borderRadius: 21, paddingHorizontal: 15, paddingVertical: 12, alignItems: 'center', marginTop: 18 }, assignButtonText: { color: '#fff', fontWeight: 'bold' }, empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 28, alignItems: 'center', marginTop: 16 }, emptyTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold' }, emptyText: { color: '#536b7a', marginTop: 6 }, backdrop: { flex: 1, backgroundColor: 'rgba(8,34,48,.48)', justifyContent: 'center', padding: 18 }, modal: { width: '100%', maxWidth: 620, maxHeight: '90%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 19, padding: 20 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, modalTitle: { color: '#123b52', fontSize: 21, fontWeight: 'bold' }, modalHint: { color: '#536b7a', fontSize: 12, marginTop: 3 }, close: { color: '#536b7a', fontSize: 27 }, inventoryList: { maxHeight: 430, marginTop: 12 }, inventoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#edf2f3', paddingVertical: 11 }, inventoryRowActive: { backgroundColor: '#e4f2ee' }, inventoryCheck: { width: 23, height: 23, borderWidth: 1, borderColor: '#aabfc7', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, inventoryCheckText: { color: '#0b777b', fontWeight: 'bold' }, inventoryCopy: { flex: 1, minWidth: 0 }, inventoryName: { color: '#123b52', fontWeight: 'bold' }, inventoryMeta: { color: '#536b7a', fontSize: 11, marginTop: 3 }, doneButton: { backgroundColor: '#123b52', borderRadius: 21, alignItems: 'center', padding: 12, marginTop: 14 }, doneText: { color: '#fff', fontWeight: 'bold' },
});
