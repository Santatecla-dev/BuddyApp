import { Equipment, EquipmentCondition } from '../types';

// Use the same 30-day maintenance window for filters, badges and insights.
export const isDueSoon = (item: Equipment) => {
  if (item.condition === 'retired') return false;
  if (item.condition === 'service_due') return true;
  if (!item.nextServiceDate) return false;
  const next = new Date(item.nextServiceDate).getTime();
  return Number.isFinite(next) && next <= Date.now() + 30 * 86400000;
};

export const getEquipmentStatus = (item: Equipment): EquipmentCondition =>
  item.condition === 'retired' ? 'retired' : isDueSoon(item) ? 'service_due' : 'good';
