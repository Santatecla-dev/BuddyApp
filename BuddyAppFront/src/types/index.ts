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

export type PokedexCategory = 'Sharks' | 'Tropical fish' | 'Macro' | 'Crustaceans' | 'Rays' | 'Pelagic';

export interface PokedexSpecies {
  key: string;
  name: string;
  category: PokedexCategory;
  imageUrl: string;
  sightingsCount?: number;
}
