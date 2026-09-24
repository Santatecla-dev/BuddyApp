import { WarehouseObject, WarehouseObjectType } from '../types';

export const DEFAULT_SIZES: Record<WarehouseObjectType, { width: number; height: number }> = {
  rack: { width: 4, height: 2 }, shelf: { width: 3, height: 2 },
  workbench: { width: 4, height: 2 }, zone: { width: 6, height: 4 },
  compressor: { width: 2, height: 2 },
};
export const isStorage = (type: WarehouseObjectType) => ['rack', 'shelf', 'workbench'].includes(type);
type Shape = Pick<WarehouseObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>;
type MapSize = { width: number; height: number };

// x/y anchor the reserved, grid-aligned footprint, matching the server contract.
// Diagonal objects reserve their enclosing squares, including corner clearance.
export function rotatedFootprint(object: Pick<Shape, 'width' | 'height' | 'rotation'>) {
  const angle = ((object.rotation || 0) % 180 + 180) % 180;
  if (angle === 90) return { width: object.height, height: object.width };
  if (angle === 45 || angle === 135) {
    const diagonal = Math.ceil((object.width + object.height) / Math.sqrt(2));
    return { width: diagonal, height: diagonal };
  }
  return { width: object.width, height: object.height };
}
export function fitsMap(object: Shape, map: MapSize) {
  const bounds = rotatedFootprint(object);
  return [object.x, object.y, object.width, object.height].every(Number.isInteger)
    && object.width >= 1 && object.height >= 1 && object.x >= 0 && object.y >= 0
    && object.x + bounds.width <= map.width && object.y + bounds.height <= map.height;
}
export function placementError(candidate: Shape & { id?: number }, map: MapSize, objects: WarehouseObject[]) {
  if (!fitsMap(candidate, map)) return 'This object must stay inside the warehouse boundaries.';
  const bounds = rotatedFootprint(candidate);
  const collision = objects.find(other => {
    if (other.id === candidate.id) return false;
    const otherBounds = rotatedFootprint(other);
    return candidate.x < other.x + otherBounds.width && candidate.x + bounds.width > other.x
      && candidate.y < other.y + otherBounds.height && candidate.y + bounds.height > other.y;
  });
  return collision ? `This would overlap ${collision.label}. Choose a free area or a smaller size.` : '';
}
export function findPlacement(size: MapSize, map: MapSize, objects: WarehouseObject[]) {
  for (let y = 0; y <= map.height - size.height; y++) {
    for (let x = 0; x <= map.width - size.width; x++) {
      const candidate = { ...size, x, y, rotation: 0 };
      if (!placementError(candidate, map, objects)) return candidate;
    }
  }
  return null;
}
