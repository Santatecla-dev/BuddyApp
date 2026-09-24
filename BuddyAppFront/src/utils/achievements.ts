import API from '../api/api';
import { Achievement } from '../types';

export const getUnlockedAchievementIds = async (): Promise<string[] | null> => {
  try {
    const response = await API.get<Achievement[]>('/achievements');
    return (Array.isArray(response.data) ? response.data : [])
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => achievement.id);
  } catch {
    return null;
  }
};

export const getNewAchievementIds = async (previous: string[] | null) => {
  if (!previous) return [];
  const current = await getUnlockedAchievementIds();
  if (!current) return [];
  return current.filter((id) => !previous.includes(id));
};
