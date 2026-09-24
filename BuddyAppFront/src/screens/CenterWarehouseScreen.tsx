import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { CenterInventoryItem, CenterWarehouse, WarehouseObject, WarehouseObjectType } from '../types';

const CELL = 28;

const OBJECT_TYPES: Array<{
  type: WarehouseObjectType;
  label: string;
  color: string;
  defaultWidth: number;
  defaultHeight: number;
  canStoreInventory: boolean;
}> = [
  { type: 'rack', label: 'Rack', color: '#123b52', defaultWidth: 4, defaultHeight: 2, canStoreInventory: true },
  { type: 'shelf', label: 'Shelf', color: '#0b777b', defaultWidth: 3, defaultHeight: 2, canStoreInventory: true },
  { type: 'workbench', label: 'Workbench', color: '#7b5a1d', defaultWidth: 4, defaultHeight: 2, canStoreInventory: false },
  { type: 'zone', label: 'Free zone', color: '#5c6f7b', defaultWidth: 5, defaultHeight: 4, canStoreInventory: false },
  { type: 'compressor', label: 'Compressor', color: '#7a3d47', defaultWidth: 3, defaultHeight: 3, canStoreInventory: false },
];

const titleFor = (type: WarehouseObjectType) => OBJECT_TYPES.find((item) => item.type === type)?.label || 'Object';
const canHoldInventory = (type: WarehouseObjectType) => OBJECT_TYPES.find((item) => item.type === type)?.canStoreInventory ?? false;
const ROTATABLE_TYPES: WarehouseObjectType[] = ['rack', 'shelf', 'workbench'];

interface ObjectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const getRotatedBounds = (x: number, y: number, width: number, height: number, rotation: number): ObjectBounds => {
  const angle = ((rotation % 180) + 180) % 180;
  if (angle === 90) {
    return { x, y, width: height, height: width };
  }
  if (angle === 45 || angle === 135) {
    const diagonal = Math.ceil((width + height) / Math.sqrt(2));
    return { x, y, width: diagonal, height: diagonal };
  }
  return { x, y, width, height };
};

const checkObjectFits = (
  candidate: { x: number; y: number; width: number; height: number; rotation: number; id?: number },
  mapWidth: number,
  mapHeight: number,
  existingObjects: WarehouseObject[],
  ignoreId?: number | null
): { fits: boolean; reason?: string } => {
  const bounds = getRotatedBounds(candidate.x, candidate.y, candidate.width, candidate.height, candidate.rotation);

  if (candidate.x < 0 || candidate.y < 0) {
    return { fits: false, reason: 'Object cannot be placed outside map boundaries.' };
  }
  if (candidate.width < 1 || candidate.height < 1) {
    return { fits: false, reason: 'Object dimensions must be at least 1 square.' };
  }
  if (bounds.x + bounds.width > mapWidth || bounds.y + bounds.height > mapHeight) {
    return { fits: false, reason: 'This action would exceed warehouse boundaries.' };
  }

  for (const other of existingObjects) {
    if (ignoreId !== undefined && ignoreId !== null && other.id === ignoreId) continue;
    if (candidate.id !== undefined && other.id === candidate.id) continue;

    const otherBounds = getRotatedBounds(other.x, other.y, other.width, other.height, other.rotation || 0);

    const overlaps =
      bounds.x < otherBounds.x + otherBounds.width &&
      bounds.x + bounds.width > otherBounds.x &&
      bounds.y < otherBounds.y + otherBounds.height &&
      bounds.y + bounds.height > otherBounds.y;

    if (overlaps) {
      return { fits: false, reason: `Overlaps with "${other.label}". Choose a free area.` };
    }
  }

  return { fits: true };
};

const findFreePosition = (
  type: WarehouseObjectType,
  width: number,
  height: number,
  mapWidth: number,
  mapHeight: number,
  existingObjects: WarehouseObject[]
): { x: number; y: number } | null => {
  for (let y = 0; y <= mapHeight - height; y++) {
    for (let x = 0; x <= mapWidth - width; x++) {
      const check = checkObjectFits({ x, y, width, height, rotation: 0 }, mapWidth, mapHeight, existingObjects);
      if (check.fits) {
        return { x, y };
      }
    }
  }
  return null;
};

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

  // Pending reassignment state for custom dialog / confirm warning
  const [pendingReassign, setPendingReassign] = useState<{
    item: CenterInventoryItem;
    sourceObjectName: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get<CenterWarehouse>('/center/warehouse');
      setData(response.data);
      setMapName(response.data.map.name);
      setMapWidth(String(response.data.map.width));
      setMapHeight(String(response.data.map.height));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the warehouse map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selected = data?.objects.find((object) => object.id === selectedId) || null;

  // Selected object's inventory & total physical units
  const selectedInventory = useMemo(
    () => data?.inventory.filter((item) => item.warehouseObjectId === selectedId) || [],
    [data, selectedId]
  );

  const selectedTotalUnits = useMemo(
    () => selectedInventory.reduce((acc, item) => acc + (item.quantity || 1), 0),
    [selectedInventory]
  );

  // Map of objectId -> total units count for swift badge display
  const objectUnitCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    if (!data) return counts;
    for (const item of data.inventory) {
      if (item.warehouseObjectId) {
        counts[item.warehouseObjectId] = (counts[item.warehouseObjectId] || 0) + (item.quantity || 1);
      }
    }
    return counts;
  }, [data]);

  // Inventory filtering:
  // When showUnassignedOnly is true, show items where warehouseObjectId is null or undefined
  const filteredInventory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (
      data?.inventory.filter((item) => {
        if (showUnassignedOnly && item.warehouseObjectId !== null && item.warehouseObjectId !== undefined) {
          return false;
        }
        if (normalized && !`${item.name} ${item.category}`.toLowerCase().includes(normalized)) {
          return false;
        }
        return true;
      }) || []
    );
  }, [data, query, showUnassignedOnly]);

  const addObject = async (type: WarehouseObjectType) => {
    if (!data) return;
    const definition = OBJECT_TYPES.find((item) => item.type === type)!;

    let width = definition.defaultWidth;
    let height = definition.defaultHeight;
    if (type === 'compressor') {
      height = width;
    }

    if (width > data.map.width || height > data.map.height) {
      setError(`Cannot add ${definition.label}: Warehouse map is too small for its default size.`);
      return;
    }

    const freePos = findFreePosition(type, width, height, data.map.width, data.map.height, data.objects);
    if (!freePos) {
      setError(`No free space available on the warehouse map to place a new ${definition.label}.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await API.post<WarehouseObject>('/center/warehouse/objects', {
        type,
        label: `${definition.label} ${(data.objects.filter((item) => item.type === type).length || 0) + 1}`,
        color: definition.color,
        width,
        height,
        x: freePos.x,
        y: freePos.y,
        rotation: 0,
      });
      setData((current) => (current ? { ...current, objects: [...current.objects, response.data] } : current));
      setSelectedId(response.data.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add this warehouse object.');
    } finally {
      setSaving(false);
    }
  };

  const patchObject = async (changes: Partial<WarehouseObject>) => {
    if (!selected || !data) return;

    const candidate = {
      id: selected.id,
      x: changes.x !== undefined ? changes.x : selected.x,
      y: changes.y !== undefined ? changes.y : selected.y,
      width: changes.width !== undefined ? changes.width : selected.width,
      height: changes.height !== undefined ? changes.height : selected.height,
      rotation: changes.rotation !== undefined ? changes.rotation : selected.rotation || 0,
    };

    if (selected.type === 'compressor' && changes.width !== undefined) {
      candidate.height = changes.width;
      changes.height = changes.width;
    }

    const fitCheck = checkObjectFits(candidate, data.map.width, data.map.height, data.objects, selected.id);
    if (!fitCheck.fits) {
      setError(fitCheck.reason || 'This adjustment causes a collision or exceeds boundaries.');
      return;
    }

    setError('');
    try {
      const response = await API.patch<WarehouseObject>(`/center/warehouse/objects/${selected.id}`, changes);
      setData((current) =>
        current
          ? {
              ...current,
              objects: current.objects.map((object) => (object.id === selected.id ? response.data : object)),
            }
          : current
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update the selected object.');
    }
  };

  const move = (dx: number, dy: number) => {
    if (!selected || !data) return;
    const targetX = selected.x + dx;
    const targetY = selected.y + dy;
    patchObject({ x: targetX, y: targetY });
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await API.delete(`/center/warehouse/objects/${selected.id}`);
      setData((current) =>
        current
          ? {
              ...current,
              objects: current.objects.filter((object) => object.id !== selected.id),
              inventory: current.inventory.map((item) =>
                item.warehouseObjectId === selected.id ? { ...item, warehouseObjectId: null } : item
              ),
            }
          : current
      );
      setSelectedId(null);
    } catch {
      setError('Could not remove this warehouse object.');
    }
  };

  const rotate = () => {
    if (!selected || !ROTATABLE_TYPES.includes(selected.type)) return;
    const nextRotation = ((selected.rotation || 0) + 45) % 360;
    patchObject({ rotation: nextRotation });
  };

  const clearAll = async () => {
    const message = 'Delete every object from this warehouse map? Inventory items will remain unassigned.';
    if (Platform.OS === 'web') {
      if (!window.confirm(message)) return;
    }
    try {
      await API.delete('/center/warehouse/objects');
      setData((current) =>
        current
          ? {
              ...current,
              objects: [],
              inventory: current.inventory.map((item) => ({ ...item, warehouseObjectId: null })),
            }
          : current
      );
      setSelectedId(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not clear the warehouse map.');
    }
  };

  const executeAssign = async (itemId: number, newWarehouseObjectId: number | null) => {
    try {
      await API.patch(`/center/inventory/${itemId}`, { warehouseObjectId: newWarehouseObjectId });
      setData((current) =>
        current
          ? {
              ...current,
              inventory: current.inventory.map((candidate) =>
                candidate.id === itemId ? { ...candidate, warehouseObjectId: newWarehouseObjectId } : candidate
              ),
            }
          : current
      );
      setPendingReassign(null);
    } catch {
      setError('Could not update this inventory location.');
    }
  };

  const handleAssignClick = (item: CenterInventoryItem) => {
    if (!selected || !data) return;

    if (!canHoldInventory(selected.type)) {
      setError(`Cannot assign inventory: "${selected.label}" is a ${titleFor(selected.type)} and is not a storage unit.`);
      return;
    }

    if (item.warehouseObjectId === selected.id) {
      executeAssign(item.id, null);
      return;
    }

    if (item.warehouseObjectId && item.warehouseObjectId !== selected.id) {
      const sourceObj = data.objects.find((obj) => obj.id === item.warehouseObjectId);
      const sourceName = sourceObj ? sourceObj.label : 'another location';

      setPendingReassign({
        item,
        sourceObjectName: sourceName,
      });
      return;
    }

    executeAssign(item.id, selected.id);
  };

  const saveMapSettings = async () => {
    const width = Number(mapWidth);
    const height = Number(mapHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 6 || height < 6) {
      setError('Warehouse dimensions must be whole numbers of at least 6 squares.');
      return;
    }

    if (data && data.objects.length > 0) {
      const cutsOff = data.objects.some((obj) => {
        const bounds = getRotatedBounds(obj.x, obj.y, obj.width, obj.height, obj.rotation || 0);
        return bounds.x + bounds.width > width || bounds.y + bounds.height > height;
      });
      if (cutsOff) {
        setError('The new warehouse dimensions would cut off one or more placed objects. Move them first.');
        return;
      }
    }

    try {
      const response = await API.patch('/center/warehouse', {
        name: mapName.trim() || 'Main warehouse',
        width,
        height,
      });
      setData((current) => (current ? { ...current, map: response.data } : current));
      setMapSettings(false);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save the warehouse dimensions.');
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#123b52" />
        <Text style={styles.loading}>Loading warehouse map…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
        <TouchableOpacity style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>CENTER OPERATIONS</Text>
            <Text style={styles.title}>Warehouse layout</Text>
            <Text style={styles.subtitle}>
              Design your storage floor, then open a rack or shelf to see the inventory assigned to it.
            </Text>
          </View>
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeValue}>{data.objects.length}</Text>
            <Text style={styles.mapBadgeLabel}>map objects</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.alertBanner} accessibilityRole="alert">
            <Text style={styles.alertBannerText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')} style={styles.alertBannerClose}>
              <Text style={styles.alertBannerCloseText}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Layout tools row */}
        <View style={styles.layoutToolsRow}>
          <Text style={styles.layoutToolsLabel}>Layout tools</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.deleteAllButton} onPress={clearAll}>
            <Text style={styles.deleteAllText}>Delete all objects</Text>
          </TouchableOpacity>
        </View>

        {/* Toolbar: fully responsive, wraps on narrow viewports */}
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>Add to the map</Text>
          <View style={styles.toolRow}>
            {OBJECT_TYPES.map((item) => (
              <TouchableOpacity
                key={item.type}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.label} to warehouse map`}
                style={[styles.toolButton, { borderColor: item.color }]}
                disabled={saving}
                onPress={() => addObject(item.type)}
              >
                <Text style={[styles.toolText, { color: item.color }]}>+ {item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Blueprint Map Panel: responsive with scrollEnabled horizontal scroll */}
        <View style={styles.mapPanel}>
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderCopy}>
              <Text style={styles.sectionTitle}>{data.map.name}</Text>
              <Text style={styles.sectionHint}>
                {data.map.width} × {data.map.height} squares · Select an object to edit or inspect.
              </Text>
            </View>
            <View style={styles.mapHeaderActions}>
              <Text style={styles.legend}>BLUEPRINT</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit warehouse map canvas dimensions"
                style={styles.settingsButton}
                onPress={() => setMapSettings(true)}
              >
                <Text style={styles.settingsText}>Edit map</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.mapViewport} nestedScrollEnabled showsVerticalScrollIndicator>
            <ScrollView
              horizontal
              scrollEnabled={true}
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.mapScroll}
            >
              <View
                style={[
                  styles.map,
                  {
                    width: data.map.width * CELL,
                    height: data.map.height * CELL,
                  },
                ]}
              >
                {Array.from({ length: data.map.width * data.map.height }, (_, index) => (
                  <View key={index} style={styles.gridCell} />
                ))}
                {data.objects.map((object) => {
                  const objectWidth = object.width;
                  const objectHeight = object.height;
                  const totalUnits = objectUnitCounts[object.id] || 0;
                  const canStore = canHoldInventory(object.type);

                  return (
                    <TouchableOpacity
                      key={object.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${object.label}, ${titleFor(object.type)}${
                        canStore ? `, ${totalUnits} units assigned` : ''
                      }`}
                      accessibilityState={{ selected: selectedId === object.id }}
                      onPress={() => setSelectedId(object.id)}
                      style={[
                        styles.mapObject,
                        {
                          left: object.x * CELL,
                          top: object.y * CELL,
                          width: objectWidth * CELL - 4,
                          height: objectHeight * CELL - 4,
                          backgroundColor: object.color,
                          transform: [{ rotate: `${object.rotation || 0}deg` }],
                        },
                        selectedId === object.id && styles.mapObjectSelected,
                      ]}
                    >
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.mapObjectLabel}>
                        {object.label}
                      </Text>
                      {canStore ? (
                        <Text style={styles.mapObjectCount}>
                          {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
                        </Text>
                      ) : (
                        <Text style={styles.mapObjectBadge}>{titleFor(object.type)}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </View>

        {/* Selected Object Editor or Empty State */}
        {selected ? (
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <View style={styles.editorCopy}>
                <Text style={styles.sectionTitle}>{selected.label}</Text>
                <Text style={styles.sectionHint}>
                  {titleFor(selected.type)} · {selected.width} × {selected.height} squares · {selected.rotation || 0}°
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove ${selected.label}`}
                onPress={remove}
              >
                <Text style={styles.delete}>Remove</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Label</Text>
            <TextInput
              accessibilityLabel="Warehouse object label"
              value={selected.label}
              onChangeText={(value) => patchObject({ label: value })}
              style={styles.input}
            />

            <View style={styles.controls}>
              {/* Position directional buttons */}
              <View>
                <Text style={styles.controlLabel}>Position</Text>
                <View style={styles.arrowGrid}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Move up"
                    onPress={() => move(0, -1)}
                    style={styles.arrow}
                  >
                    <Text style={styles.arrowText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Move left"
                    onPress={() => move(-1, 0)}
                    style={styles.arrow}
                  >
                    <Text style={styles.arrowText}>←</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Move right"
                    onPress={() => move(1, 0)}
                    style={styles.arrow}
                  >
                    <Text style={styles.arrowText}>→</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Move down"
                    onPress={() => move(0, 1)}
                    style={styles.arrow}
                  >
                    <Text style={styles.arrowText}>↓</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Size & Orientation */}
              <View>
                <Text style={styles.controlLabel}>Size & orientation</Text>
                <View style={styles.sizeButtons}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Decrease width"
                    style={styles.sizeButton}
                    onPress={() => patchObject({ width: Math.max(1, selected.width - 1) })}
                  >
                    <Text style={styles.sizeText}>− width</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Increase width"
                    style={styles.sizeButton}
                    onPress={() => patchObject({ width: Math.min(data.map.width, selected.width + 1) })}
                  >
                    <Text style={styles.sizeText}>+ width</Text>
                  </TouchableOpacity>

                  {selected.type !== 'compressor' ? (
                    <>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Decrease height"
                        style={styles.sizeButton}
                        onPress={() => patchObject({ height: Math.max(1, selected.height - 1) })}
                      >
                        <Text style={styles.sizeText}>− height</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Increase height"
                        style={styles.sizeButton}
                        onPress={() => patchObject({ height: Math.min(data.map.height, selected.height + 1) })}
                      >
                        <Text style={styles.sizeText}>+ height</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Rotate object 45 degrees"
                    disabled={!ROTATABLE_TYPES.includes(selected.type)}
                    style={[styles.sizeButton, !ROTATABLE_TYPES.includes(selected.type) ? styles.sizeButtonDisabled : undefined]}
                    onPress={rotate}
                  >
                    <Text style={styles.sizeText}>Rotate 45°</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Inventory Assignment Button or Not Available Notice */}
            {canHoldInventory(selected.type) ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Manage assigned inventory, ${selectedTotalUnits} units currently assigned`}
                style={styles.assignButton}
                onPress={() => setModal(true)}
              >
                <Text style={styles.assignButtonText}>
                  Manage assigned inventory ({selectedTotalUnits} {selectedTotalUnits === 1 ? 'unit' : 'units'})
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.notStorageNotice}>
                <Text style={styles.notStorageNoticeText}>
                  {selected.type === 'zone'
                    ? 'Free zones represent open floor space and cannot have inventory assigned directly.'
                    : selected.type === 'compressor'
                    ? 'Compressors are machinery and not storage units. Use racks or shelves for inventory.'
                    : 'Workbenches are maintenance spaces and not storage units.'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Select a rack, shelf, or zone</Text>
            <Text style={styles.emptyText}>Click any object on the map to adjust its position or inspect details.</Text>
          </View>
        )}

        {/* Filter unassigned inventory switch */}
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityLabel="Toggle filter to show only unassigned inventory"
          accessibilityState={{ checked: showUnassignedOnly }}
          onPress={() => setShowUnassignedOnly((value) => !value)}
          style={[styles.filterToggle, showUnassignedOnly ? styles.filterToggleActive : undefined]}
        >
          <Text style={[styles.filterToggleText, showUnassignedOnly ? styles.filterToggleTextActive : undefined]}>
            {showUnassignedOnly ? 'Showing unassigned inventory only' : 'Filter unassigned inventory'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal: Inventory Assignment */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign inventory</Text>
                <Text style={styles.modalHint}>
                  {selected?.label || 'Selected storage unit'} · {selectedTotalUnits} total physical units
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close inventory assignment dialog"
                onPress={() => setModal(false)}
              >
                <Text style={styles.close}>×</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              accessibilityLabel="Search warehouse inventory"
              placeholder="Search equipment by name or category"
              placeholderTextColor="#718394"
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />

            <ScrollView style={styles.inventoryList} keyboardShouldPersistTaps="handled">
              {filteredInventory.length === 0 ? (
                <View style={styles.emptyInventory}>
                  <Text style={styles.emptyInventoryText}>
                    {showUnassignedOnly ? 'No unassigned items found.' : 'No items match your search.'}
                  </Text>
                </View>
              ) : (
                filteredInventory.map((item) => {
                  const isAssignedHere = item.warehouseObjectId === selectedId;
                  const isAssignedElsewhere = item.warehouseObjectId !== null && item.warehouseObjectId !== undefined && item.warehouseObjectId !== selectedId;
                  const otherObject = isAssignedElsewhere
                    ? data.objects.find((obj) => obj.id === item.warehouseObjectId)
                    : null;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${item.name}, ${item.quantity} ${
                        item.quantity === 1 ? 'unit' : 'units'
                      }, ${isAssignedHere ? 'assigned here' : isAssignedElsewhere ? `assigned to ${otherObject?.label || 'elsewhere'}` : 'unassigned'}`}
                      accessibilityState={{ checked: isAssignedHere }}
                      onPress={() => handleAssignClick(item)}
                      style={[
                        styles.inventoryRow,
                        isAssignedHere ? styles.inventoryRowActive : undefined,
                        isAssignedElsewhere ? styles.inventoryRowElsewhere : undefined,
                      ]}
                    >
                      <View style={[styles.inventoryCheck, isAssignedHere ? styles.inventoryCheckActive : undefined]}>
                        <Text style={[styles.inventoryCheckText, isAssignedHere ? styles.inventoryCheckTextActive : undefined]}>
                          {isAssignedHere ? '✓' : ''}
                        </Text>
                      </View>
                      <View style={styles.inventoryCopy}>
                        <Text style={styles.inventoryName}>{item.name}</Text>
                        <Text style={styles.inventoryMeta}>
                          {item.category} · {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
                          {isAssignedElsewhere ? (
                            <Text style={styles.assignedElsewhereText}>
                              {' '}· Assigned to {otherObject?.label || 'another object'}
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                      {isAssignedElsewhere ? (
                        <View style={styles.reassignBadge}>
                          <Text style={styles.reassignBadgeText}>Reassign</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Done assigning inventory"
              style={styles.doneButton}
              onPress={() => setModal(false)}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal for Reassigning items assigned elsewhere */}
      <Modal
        visible={pendingReassign !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingReassign(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Reassign inventory item?</Text>
            <Text style={styles.confirmBody}>
              <Text style={{ fontWeight: 'bold' }}>{pendingReassign?.item.name}</Text> is currently assigned to{' '}
              <Text style={{ fontWeight: 'bold' }}>{pendingReassign?.sourceObjectName}</Text>.
              {'\n\n'}
              Moving it here will remove it from {pendingReassign?.sourceObjectName}. Do you want to proceed?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.confirmCancelButton}
                onPress={() => setPendingReassign(null)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.confirmActionButton}
                onPress={() => {
                  if (pendingReassign && selected) {
                    executeAssign(pendingReassign.item.id, selected.id);
                  }
                }}
              >
                <Text style={styles.confirmActionText}>Reassign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Map Settings */}
      <Modal visible={mapSettings} transparent animationType="slide" onRequestClose={() => setMapSettings(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Warehouse canvas</Text>
                <Text style={styles.modalHint}>Resize the grid without cutting off placed objects.</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close map settings"
                onPress={() => setMapSettings(false)}
              >
                <Text style={styles.close}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Map name</Text>
            <TextInput
              accessibilityLabel="Warehouse map name"
              value={mapName}
              onChangeText={setMapName}
              style={styles.input}
            />

            <View style={styles.dimensionRow}>
              <View style={styles.dimensionField}>
                <Text style={styles.label}>Width (squares)</Text>
                <TextInput
                  accessibilityLabel="Warehouse map width"
                  keyboardType="number-pad"
                  value={mapWidth}
                  onChangeText={setMapWidth}
                  style={styles.input}
                />
              </View>
              <View style={styles.dimensionField}>
                <Text style={styles.label}>Height (squares)</Text>
                <TextInput
                  accessibilityLabel="Warehouse map height"
                  keyboardType="number-pad"
                  value={mapHeight}
                  onChangeText={setMapHeight}
                  style={styles.input}
                />
              </View>
            </View>

            <Text style={styles.dimensionHint}>
              Larger maps can be explored using horizontal and vertical scrolling.
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Save warehouse canvas dimensions"
              style={styles.doneButton}
              onPress={saveMapSettings}
            >
              <Text style={styles.doneText}>Save canvas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f6f8',
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loading: {
    color: '#536b7a',
    marginTop: 10,
  },
  error: {
    color: '#b42318',
    marginTop: 12,
    textAlign: 'center',
  },
  retry: {
    borderWidth: 1,
    borderColor: '#123b52',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
  },
  retryText: {
    color: '#123b52',
    fontWeight: 'bold',
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#e1ebee',
    borderWidth: 1,
    borderColor: '#b9cdd3',
    borderRadius: 22,
    padding: 24,
  },
  heroCopy: {
    flex: 1,
    minWidth: 260,
  },
  eyebrow: {
    color: '#0b777b',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  title: {
    color: '#123b52',
    fontSize: 29,
    fontWeight: 'bold',
    marginTop: 5,
  },
  subtitle: {
    color: '#536b7a',
    lineHeight: 21,
    marginTop: 7,
  },
  mapBadge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBadgeValue: {
    color: '#123b52',
    fontSize: 22,
    fontWeight: 'bold',
  },
  mapBadgeLabel: {
    color: '#718394',
    fontSize: 10,
    marginTop: 2,
  },
  alertBanner: {
    backgroundColor: '#fef3f2',
    borderWidth: 1,
    borderColor: '#fecdca',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertBannerText: {
    color: '#b42318',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  alertBannerClose: {
    paddingLeft: 8,
    paddingVertical: 2,
  },
  alertBannerCloseText: {
    color: '#b42318',
    fontSize: 18,
    fontWeight: 'bold',
  },
  layoutToolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  layoutToolsLabel: {
    color: '#718394',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteAllButton: {
    borderWidth: 1,
    borderColor: '#b42318',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  deleteAllText: {
    color: '#b42318',
    fontSize: 12,
    fontWeight: 'bold',
  },
  toolbar: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 16,
    padding: 15,
    marginTop: 14,
  },
  toolbarTitle: {
    color: '#123b52',
    fontWeight: 'bold',
  },
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  toolButton: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  toolText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 16,
    marginTop: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  mapHeaderCopy: {
    flex: 1,
    minWidth: 200,
  },
  mapHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsButton: {
    borderWidth: 1,
    borderColor: '#0b777b',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  settingsText: {
    color: '#0b777b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#123b52',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHint: {
    color: '#718394',
    fontSize: 12,
    marginTop: 4,
  },
  legend: {
    color: '#0b777b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  mapViewport: {
    maxHeight: 520,
    marginTop: 12,
  },
  mapScroll: {
    padding: 14,
  },
  map: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
    backgroundColor: '#f7fafb',
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 4,
  },
  gridCell: {
    width: CELL,
    height: CELL,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dbe7ea',
  },
  mapObject: {
    position: 'absolute',
    borderRadius: 7,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.85)',
  },
  mapObjectSelected: {
    borderColor: '#f3bb4b',
    borderWidth: 3,
    shadowColor: '#123b52',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  mapObjectLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mapObjectCount: {
    color: '#e7f3f5',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mapObjectBadge: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  editor: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 18,
    marginTop: 16,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  editorCopy: {
    flex: 1,
  },
  delete: {
    color: '#b42318',
    fontWeight: 'bold',
  },
  label: {
    color: '#123b52',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    minHeight: 45,
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#263f4d',
    backgroundColor: '#fff',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    marginTop: 16,
  },
  controlLabel: {
    color: '#718394',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  arrowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 132,
    gap: 5,
  },
  arrow: {
    width: 38,
    height: 34,
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fafb',
  },
  arrowText: {
    color: '#123b52',
    fontSize: 18,
  },
  sizeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  sizeButton: {
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#f7fafb',
  },
  sizeButtonDisabled: {
    opacity: 0.4,
  },
  sizeText: {
    color: '#0b777b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  assignButton: {
    backgroundColor: '#123b52',
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  assignButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  notStorageNotice: {
    backgroundColor: '#f0f5f7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d2e1e6',
    padding: 14,
    marginTop: 18,
  },
  notStorageNoticeText: {
    color: '#5c6f7b',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  empty: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 28,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    color: '#123b52',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#718394',
    marginTop: 6,
    textAlign: 'center',
  },
  filterToggle: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
    backgroundColor: '#fff',
  },
  filterToggleActive: {
    backgroundColor: '#e4f2ee',
    borderColor: '#0b777b',
  },
  filterToggleText: {
    color: '#5c6f7b',
    fontSize: 12,
    fontWeight: '600',
  },
  filterToggleTextActive: {
    color: '#0b777b',
    fontWeight: 'bold',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,34,48,.48)',
    justifyContent: 'center',
    padding: 18,
  },
  modal: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 19,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#123b52',
    fontSize: 21,
    fontWeight: 'bold',
  },
  modalHint: {
    color: '#718394',
    fontSize: 12,
    marginTop: 3,
  },
  close: {
    color: '#536b7a',
    fontSize: 27,
    paddingHorizontal: 4,
  },
  inventoryList: {
    maxHeight: 430,
    marginTop: 12,
  },
  emptyInventory: {
    padding: 24,
    alignItems: 'center',
  },
  emptyInventoryText: {
    color: '#718394',
    fontSize: 13,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f3',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  inventoryRowActive: {
    backgroundColor: '#e4f2ee',
  },
  inventoryRowElsewhere: {
    backgroundColor: '#fafbfc',
  },
  inventoryCheck: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: '#aabfc7',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  inventoryCheckActive: {
    backgroundColor: '#0b777b',
    borderColor: '#0b777b',
  },
  inventoryCheckText: {
    color: '#0b777b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  inventoryCheckTextActive: {
    color: '#fff',
  },
  inventoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  inventoryName: {
    color: '#123b52',
    fontWeight: 'bold',
    fontSize: 13,
  },
  inventoryMeta: {
    color: '#718394',
    fontSize: 11,
    marginTop: 3,
  },
  assignedElsewhereText: {
    color: '#b56817',
    fontWeight: '600',
  },
  reassignBadge: {
    borderWidth: 1,
    borderColor: '#d08c2a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fffbf5',
  },
  reassignBadgeText: {
    color: '#b56817',
    fontSize: 10,
    fontWeight: 'bold',
  },
  doneButton: {
    backgroundColor: '#123b52',
    borderRadius: 21,
    alignItems: 'center',
    padding: 12,
    marginTop: 14,
  },
  doneText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmModal: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#ccdbe0',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmTitle: {
    color: '#123b52',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  confirmBody: {
    color: '#536b7a',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmCancelButton: {
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  confirmCancelText: {
    color: '#536b7a',
    fontWeight: 'bold',
    fontSize: 12,
  },
  confirmActionButton: {
    backgroundColor: '#0b777b',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  confirmActionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dimensionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dimensionField: {
    flex: 1,
    minWidth: 0,
  },
  dimensionHint: {
    color: '#718394',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },
});
