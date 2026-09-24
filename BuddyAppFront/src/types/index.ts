export interface User {
  userId: number;
  name: string;
  email: string;
  accountType?: 'diver' | 'center';
  centerId?: number | null;
}

export interface DiveCenter {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  postalCode?: string | null;
  contactName?: string | null;
  timezone?: string | null;
  openingHours?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  verified?: boolean;
}

export interface CenterProfile {
  center: DiveCenter;
  stats: { loggedDives: number; plannedDives: number; clients: number; assetTypes: number; inventoryUnits: number; availableUnits: number };
  clientsPreview: CenterClient[];
  clientRanking: CenterClient[];
  createdAt: string;
  updatedAt: string;
}

export interface Dive {
  id: number;
  date: string;
  location: string;
  maxDepth: number;
  duration: number;
  notes?: string;
  country: string;
  centerId?: number | null;
  center?: DiveCenter | null;
  createdByUserId?: number | null;
  canEdit?: boolean;
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
  centerId?: number | null;
  center?: DiveCenter | null;
}

export type CenterInventoryStatus = 'available' | 'maintenance' | 'retired';

export interface CenterInventoryItem {
  id: number;
  centerId: number;
  name: string;
  category: string;
  quantity: number;
  status: CenterInventoryStatus;
  location?: string | null;
  notes?: string | null;
  nextServiceDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CenterClient {
  id: number;
  name: string;
  email: string;
  dives: number;
  lastDive?: string | null;
}

export interface CenterLinkRequest {
  id: number;
  diveId: number;
  centerId: number;
  requestedByUserId: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  message?: string | null;
  createdAt: string;
  dive?: Dive;
  center?: DiveCenter;
  requestedBy?: User;
}

export interface PlannedDiveInvite {
  id: number;
  plannedDive: PlannedDive;
  invitedByUser?: User;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
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
