import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Dive } from '../dives/dive.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { DiveSighting } from '../dives/dive-sighting.entity';
import { POKEDEX_SPECIES } from '../dives/pokedex.catalog';
import { AchievementPin } from './achievement-pin.entity';
import { AchievementState } from './achievement-state.entity';

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'dives' | 'wildlife' | 'exploration';
  target: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
};

export type AchievementEvidence = {
  kind: 'dive' | 'species' | 'country';
  label: string;
  id?: number;
};

const SHARK_KEYS = POKEDEX_SPECIES.filter((species) => species.category === 'Sharks').map((species) => species.key);
const SPECIES_KEYS = POKEDEX_SPECIES.map((species) => species.key);
const MACRO_KEYS = POKEDEX_SPECIES.filter((species) => species.category === 'Macro').map((species) => species.key);
const RAY_KEYS = POKEDEX_SPECIES.filter((species) => species.category === 'Rays').map((species) => species.key);
const APEX_KEYS = ['great-white-shark', 'tiger-shark', 'bull-shark'];
const GIANT_SHARK_KEYS = ['whale-shark', 'basking-shark'];

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: 'first-dive', title: 'First splash', description: 'Log your very first dive.', icon: '🤿', category: 'dives', target: 1, tier: 'bronze' },
  { id: 'ten-dives', title: 'Getting serious', description: 'Complete your first 10 dives.', icon: '🔟', category: 'dives', target: 10, tier: 'silver' },
  { id: 'hundred-dives', title: 'Century diver', description: 'Reach 100 logged dives.', icon: '💯', category: 'dives', target: 100, tier: 'gold' },
  { id: 'thousand-dives', title: 'Deep routine', description: 'Reach 1,000 logged dives.', icon: '🌊', category: 'dives', target: 1000, tier: 'gold' },
  { id: 'ten-thousand-dives', title: 'Ocean legend', description: 'Reach 10,000 logged dives.', icon: '🏆', category: 'dives', target: 10000, tier: 'platinum' },
  { id: 'species-spotter', title: 'Species spotter', description: 'Record five different marine species.', icon: '🔎', category: 'wildlife', target: 5, tier: 'bronze' },
  { id: 'species-collector', title: 'Species collector', description: 'Record 15 different marine species.', icon: '🗂️', category: 'wildlife', target: 15, tier: 'silver' },
  { id: 'species-curator', title: 'Species curator', description: 'Complete the marine life album.', icon: '🏛️', category: 'wildlife', target: SPECIES_KEYS.length, tier: 'gold' },
  { id: 'any-shark', title: 'Shark encounter', description: 'Record any shark species in your Pokedex.', icon: '🦈', category: 'wildlife', target: 1, tier: 'bronze' },
  { id: 'all-sharks', title: 'Shark historian', description: 'Record every shark species in the album.', icon: '🌐', category: 'wildlife', target: SHARK_KEYS.length, tier: 'gold' },
  { id: 'apex-trio', title: 'Apex trio', description: 'See a great white, tiger and bull shark.', icon: '👑', category: 'wildlife', target: APEX_KEYS.length, tier: 'gold' },
  { id: 'macro-lover', title: 'Macro lover', description: 'Record every macro species in the album.', icon: '🔬', category: 'wildlife', target: MACRO_KEYS.length, tier: 'gold' },
  { id: 'all-rays', title: 'Ray collector', description: 'Record every ray species in the album.', icon: '🌊', category: 'wildlife', target: RAY_KEYS.length, tier: 'gold' },
  { id: 'giant-shark-duo', title: 'Giant shark duo', description: 'See both a whale shark and a basking shark.', icon: '🐋', category: 'wildlife', target: GIANT_SHARK_KEYS.length, tier: 'silver' },
  { id: 'five-continents', title: 'Five continents', description: 'Dive in five different continents.', icon: '🧭', category: 'exploration', target: 5, tier: 'gold' },
];

const CONTINENT_COUNTRIES: Record<string, string[]> = {
  Europe: ['Spain', 'Portugal', 'France', 'Italy', 'Germany', 'Greece', 'United Kingdom', 'Croatia', 'Malta', 'Norway', 'Sweden', 'Iceland', 'Ireland', 'Netherlands', 'Slovenia', 'Montenegro', 'Cyprus', 'Turkey'],
  Asia: ['Japan', 'Philippines', 'Indonesia', 'Thailand', 'Malaysia', 'Maldives', 'India', 'Sri Lanka', 'China', 'Vietnam', 'Taiwan'],
  Africa: ['South Africa', 'Egypt', 'Morocco', 'Tanzania', 'Kenya', 'Mozambique', 'Mauritius', 'Madagascar', 'Seychelles', 'Comoros'],
  'North America': ['United States', 'Canada', 'Mexico', 'Bahamas', 'Belize', 'Cuba', 'Costa Rica', 'Panama', 'Honduras', 'Dominican Republic'],
  'South America': ['Brazil', 'Peru', 'Chile', 'Ecuador', 'Colombia', 'Argentina', 'Venezuela', 'Uruguay'],
  Oceania: ['Australia', 'New Zealand', 'Fiji', 'Micronesia', 'Palau', 'Papua New Guinea', 'Samoa', 'Tonga', 'Vanuatu'],
  Antarctica: ['Antarctica'],
};

const normalizeCountry = (country: string) => country.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const COUNTRY_ALIASES: Record<string, string> = {
  espana: 'Spain', francia: 'France', italia: 'Italy', alemania: 'Germany', portugal: 'Portugal', grecia: 'Greece', croacia: 'Croatia', malta: 'Malta',
  reinounido: 'United Kingdom', paisesbajos: 'Netherlands', suiza: 'Switzerland', austria: 'Austria', belgica: 'Belgium', dinamarca: 'Denmark',
  finlandia: 'Finland', noruega: 'Norway', suecia: 'Sweden', islandia: 'Iceland', irlanda: 'Ireland', polonia: 'Poland', rumania: 'Romania',
  republicacheca: 'Czech Republic', eslovaquia: 'Slovakia', eslovenia: 'Slovenia', serbia: 'Serbia', montenegro: 'Montenegro', ucrania: 'Ukraine',
  filipinas: 'Philippines', tailandia: 'Thailand', indonesia: 'Indonesia', malasia: 'Malaysia', maldivas: 'Maldives', japon: 'Japan', india: 'India', china: 'China',
  coreadelnorte: 'North Korea', arabiasaudita: 'Saudi Arabia', emiratosarabesunidos: 'United Arab Emirates',
  singapur: 'Singapore', camboya: 'Cambodia', bangladesh: 'Bangladesh', nepal: 'Nepal', myanmar: 'Myanmar', oman: 'Oman', pakistan: 'Pakistan',
  kazajistan: 'Kazakhstan', israel: 'Israel', jordania: 'Jordan', qatar: 'Qatar', taiwan: 'Taiwan',
  australia: 'Australia', nuevazelanda: 'New Zealand', fiyi: 'Fiji', papuanuevaguinea: 'Papua New Guinea',
  islasmarshall: 'Marshall Islands', islassalomon: 'Solomon Islands', micronesia: 'Micronesia', palaos: 'Palau', samoa: 'Samoa', tonga: 'Tonga', vanuatu: 'Vanuatu',
  sudafrica: 'South Africa', egipto: 'Egypt', marruecos: 'Morocco', tanzania: 'Tanzania', republicaunidatanzania: 'Tanzania', kenia: 'Kenya', mozambique: 'Mozambique', madagascar: 'Madagascar',
  namibia: 'Namibia', seychelles: 'Seychelles', mauricio: 'Mauritius', comoras: 'Comoros', tunez: 'Tunisia',
  brasil: 'Brazil', chile: 'Chile', peru: 'Peru', ecuador: 'Ecuador', colombia: 'Colombia', argentina: 'Argentina', venezuela: 'Venezuela', uruguay: 'Uruguay', bolivia: 'Bolivia', paraguay: 'Paraguay',
  mexico: 'Mexico', bahamas: 'Bahamas', belice: 'Belize', cuba: 'Cuba', costarica: 'Costa Rica', panama: 'Panama', honduras: 'Honduras', guatemala: 'Guatemala',
  estadosunidos: 'United States', estadosunidosdeamerica: 'United States', canada: 'Canada', republicadominicana: 'Dominican Republic',
};

const continentForCountry = (country: string) => {
  const key = normalizeCountry(country).replace(/[^a-z]/g, '');
  const canonical = COUNTRY_ALIASES[key] || country;
  return Object.entries(CONTINENT_COUNTRIES).find(([, countries]) => countries.includes(canonical))?.[0];
};

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Dive) private readonly diveRepo: Repository<Dive>,
    @InjectRepository(DiveBuddy) private readonly diveBuddyRepo: Repository<DiveBuddy>,
    @InjectRepository(DiveSighting) private readonly sightingRepo: Repository<DiveSighting>,
    @InjectRepository(AchievementState) private readonly stateRepo: Repository<AchievementState>,
    @InjectRepository(AchievementPin) private readonly pinRepo: Repository<AchievementPin>,
  ) {}

  async list(userId: number) {
    const memberships = await this.diveBuddyRepo.find({ where: { userId } });
    const diveIds = memberships.map((membership) => membership.diveId);
    const dives = diveIds.length ? await this.diveRepo.find({ where: { id: In(diveIds) } }) : [];
    const sightings = diveIds.length ? await this.sightingRepo.find({ where: { diveId: In(diveIds) } }) : [];
    const speciesKeys = new Set(sightings.map((sighting) => sighting.speciesKey));
    const continents = new Set(dives.map((dive) => continentForCountry(dive.country)).filter(Boolean));
    const progress: Record<string, number> = {
      'first-dive': dives.length,
      'ten-dives': dives.length,
      'hundred-dives': dives.length,
      'thousand-dives': dives.length,
      'ten-thousand-dives': dives.length,
      'species-spotter': SPECIES_KEYS.filter((key) => speciesKeys.has(key)).length,
      'species-collector': SPECIES_KEYS.filter((key) => speciesKeys.has(key)).length,
      'species-curator': SPECIES_KEYS.filter((key) => speciesKeys.has(key)).length,
      'any-shark': SHARK_KEYS.filter((key) => speciesKeys.has(key)).length,
      'all-sharks': SHARK_KEYS.filter((key) => speciesKeys.has(key)).length,
      'apex-trio': APEX_KEYS.filter((key) => speciesKeys.has(key)).length,
      'macro-lover': MACRO_KEYS.filter((key) => speciesKeys.has(key)).length,
      'all-rays': RAY_KEYS.filter((key) => speciesKeys.has(key)).length,
      'giant-shark-duo': GIANT_SHARK_KEYS.filter((key) => speciesKeys.has(key)).length,
      'five-continents': continents.size,
    };

    const states = await this.stateRepo.find({ where: { userId } });
    const stateById = new Map(states.map((state) => [state.achievementId, state]));
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      const isUnlocked = (progress[definition.id] || 0) >= definition.target;
      let state = stateById.get(definition.id);
      if (isUnlocked && (!state || !state.unlocked)) {
        state = state || this.stateRepo.create({ userId, achievementId: definition.id });
        state.unlocked = true;
        state.unlockedAt = new Date();
        state = await this.stateRepo.save(state);
        stateById.set(definition.id, state);
      } else if (!isUnlocked && state?.unlocked) {
        state.unlocked = false;
        state = await this.stateRepo.save(state);
        stateById.set(definition.id, state);
      }
    }

    const pins = await this.pinRepo.find({ where: { userId }, order: { position: 'ASC' } });
    const pinnedIds = new Set(pins.map((pin) => pin.achievementId));
    const diveEvidence: AchievementEvidence[] = dives.map((dive) => ({
      kind: 'dive',
      id: dive.id,
      label: `${dive.location} · ${dive.country}`,
    }));
    const speciesEvidence: AchievementEvidence[] = [...speciesKeys].map((key) => ({
      kind: 'species',
      label: POKEDEX_SPECIES.find((species) => species.key === key)?.name || key,
    }));
    const countryEvidence: AchievementEvidence[] = [...new Set(dives.map((dive) => dive.country))].map((country) => ({
      kind: 'country',
      label: country,
    }));
    const speciesKeysByAchievement: Record<string, string[]> = {
      'species-spotter': SPECIES_KEYS,
      'species-collector': SPECIES_KEYS,
      'species-curator': SPECIES_KEYS,
      'any-shark': SHARK_KEYS,
      'all-sharks': SHARK_KEYS,
      'apex-trio': APEX_KEYS,
      'macro-lover': MACRO_KEYS,
      'all-rays': RAY_KEYS,
      'giant-shark-duo': GIANT_SHARK_KEYS,
    };

    return ACHIEVEMENT_DEFINITIONS.map((definition) => {
      const current = progress[definition.id] || 0;
      const state = stateById.get(definition.id);
      const evidence = definition.id === 'five-continents'
        ? countryEvidence
        : definition.category === 'dives'
          ? diveEvidence
          : (speciesKeysByAchievement[definition.id] || []).filter((key) => speciesKeys.has(key)).map((key) => ({
            kind: 'species' as const,
            label: POKEDEX_SPECIES.find((species) => species.key === key)?.name || key,
          }));
      return {
        ...definition,
        progress: Math.min(current, definition.target),
        unlocked: current >= definition.target,
        everUnlocked: Boolean(state),
        unlockedAt: state?.unlockedAt?.toISOString() || null,
        pinned: pinnedIds.has(definition.id),
        evidence: evidence.slice(0, 12),
        evidenceCount: evidence.length,
      };
    });
  }

  async history(userId: number) {
    const achievements = await this.list(userId);
    return achievements
      .filter((achievement) => achievement.everUnlocked)
      .sort((a, b) => (b.unlockedAt || '').localeCompare(a.unlockedAt || ''));
  }

  async updatePins(userId: number, achievementIds: string[]) {
    const validIds = new Set(ACHIEVEMENT_DEFINITIONS.map((definition) => definition.id));
    const ids = [...new Set(achievementIds)].filter((id) => validIds.has(id)).slice(0, 3);
    await this.pinRepo.delete({ userId });
    if (ids.length) {
      await this.pinRepo.save(ids.map((achievementId, position) => this.pinRepo.create({ userId, achievementId, position })));
    }
    return ids;
  }
}
