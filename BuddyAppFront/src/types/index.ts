export interface User {
  userId: number;
  name: string;
  email: string;
}

export interface Dive {
  id: number;
  date: string;
  location: string;
  maxDepth: number;
  duration: number;
  notes?: string;
  country: string;
}

export interface DiveBuddy {
  userId: number;
  name: string;
  email: string;
  joinedAt: string;
}

export interface DiveInvite {
  id: number;
  dive: Dive;
  invitedByUser: User;
  status: string;
}

export type ActivityFeedType = 'dive' | 'sighting' | 'achievement';

export interface ActivityFeedBuddy {
  id: number;
  name: string;
}

export interface ActivityFeedItem {
  id: string;
  type: ActivityFeedType;
  createdAt: string;
  actor: { id: number; name: string };
  dive?: { id: number; location: string; country: string; date: string; maxDepth: number; duration: number };
  species?: { key: string; name: string; category: string; imageUrl: string };
  achievement?: { id: string; title: string; description: string; icon: string; tier: string; category: string; evidence: string[] };
  commentsPreview?: ActivityFeedComment[];
  reactionsCount: number;
  commentsCount: number;
  reactedByMe: boolean;
  canOpenDive?: boolean;
}

export interface ActivityFeedComment {
  id: number;
  body: string;
  createdAt: string;
  user: { id: number; name: string };
}

export type PlannedDiveStatus = 'upcoming' | 'logged' | 'cancelled';

export interface PlannedDive {
  id: number;
  userId: number;
  date: string;
  country: string;
  location: string;
  maxDepth: number;
  duration: number;
  buddy: string;
  condition: string;
  gas: string;
  shoreEntry: boolean;
  notes?: string | null;
  checklist?: Record<string, boolean> | null;
  status: PlannedDiveStatus;
  createdAt: string;
  updatedAt: string;
}

export type DiveTripStatus = 'upcoming' | 'completed' | 'cancelled';

export interface DiveTrip {
  id: number;
  userId: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
  status: DiveTripStatus;
  createdAt: string;
  updatedAt: string;
  plannedDives: PlannedDive[];
}

export type EquipmentCondition = 'good' | 'service_due' | 'retired';

export interface Equipment {
  id: number;
  userId: number;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  nextServiceDate?: string | null;
  condition: EquipmentCondition;
  packed: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentServiceRecord {
  id: number;
  userId: number;
  equipmentId: number;
  serviceDate: string;
  nextDueDate?: string | null;
  serviceType: string;
  provider?: string | null;
  cost?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface EquipmentPacking {
  id: number;
  userId: number;
  equipmentId: number;
  tripId?: number | null;
  plannedDiveId?: number | null;
  packed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AchievementCategory = 'dives' | 'wildlife' | 'exploration';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementEvidence {
  kind: 'dive' | 'species' | 'country';
  label: string;
  id?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: AchievementTier;
  target: number;
  progress: number;
  unlocked: boolean;
  everUnlocked?: boolean;
  unlockedAt?: string | null;
  pinned?: boolean;
  evidence?: AchievementEvidence[];
  evidenceCount?: number;
}

export type PokedexCategory = 'Sharks' | 'Tropical fish' | 'Macro' | 'Crustaceans' | 'Rays' | 'Pelagic';

export interface PokedexSpecies {
  key: string;
  name: string;
  category: PokedexCategory;
  imageUrl: string;
  sightingsCount?: number;
}
