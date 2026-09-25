// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Dive } from './dive.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { CreateDiveDto } from './dto/create-dive.dto';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DiveInvite, InviteStatus } from './dive-invite.entity';
import { DiveSighting } from './dive-sighting.entity';
import { AddSightingsToDivesDto } from './dto/update-sightings.dto';
import { getSpecies, POKEDEX_SPECIES } from './pokedex.catalog';
import { DiveCenter } from '../centers/dive-center.entity';
import { CenterLinkRequest, CenterLinkRequestStatus } from '../centers/center-link-request.entity';
import { UpdateDiveDto } from './dto/update-dive.dto';

type MarineMapCoordinate = { latitude: number; longitude: number; precision: 'location' | 'country' };

// Dives currently store a country and a free-text site name rather than GPS
// coordinates. These well-known sites give the community map useful anchors;
// all other dives fall back to a country centroid and are labelled as such.
const KNOWN_SITE_COORDINATES: Record<string, [number, number]> = {
  fuvahmulah: [0.298, 73.424],
  'tiger zoo': [0.3, 73.43],
  panglao: [9.578, 123.747],
  balicasag: [9.52, 123.69],
  malapascua: [11.33, 124.12],
  moalboal: [9.94, 123.40],
  dauin: [9.19, 123.27],
  'puerto galera': [13.51, 120.95],
  cebu: [10.32, 123.90],
  palawan: [9.83, 118.74],
  'great barrier reef': [-18.29, 147.70],
  'red sea': [27.25, 34.25],
  'blue hole': [17.32, -87.53],
};

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  australia: [-25.27, 133.78], austria: [47.52, 14.55], bahamas: [24.25, -76.00],
  belize: [17.19, -88.50], brazil: [-10.81, -51.93], canada: [56.13, -106.35],
  chile: [-35.68, -71.54], china: [35.86, 104.20], colombia: [4.57, -74.30],
  costa_rica: [9.75, -83.75], croatia: [45.10, 15.20], cuba: [21.52, -77.78],
  cyprus: [35.13, 33.43], denmark: [56.26, 9.50], dominican_republic: [18.74, -70.16],
  ecuador: [-1.83, -78.18], egypt: [26.82, 30.80], fiji: [-17.71, 178.07],
  france: [46.23, 2.21], germany: [51.17, 10.45], greece: [39.07, 21.82],
  iceland: [64.96, -19.02], india: [20.59, 78.96], indonesia: [-0.79, 113.92],
  italy: [41.87, 12.57], japan: [36.20, 138.25], kenya: [-0.02, 37.91],
  malaysia: [4.21, 101.98], maldives: [3.20, 73.22], malta: [35.94, 14.38],
  mauritius: [-20.35, 57.55], mexico: [23.63, -102.55], monaco: [43.74, 7.42],
  mozambique: [-18.67, 35.53], new_zealand: [-40.90, 174.89], norway: [60.47, 8.47],
  oman: [21.47, 55.98], palau: [7.51, 134.58], panama: [8.54, -80.78],
  philippines: [12.88, 121.77], portugal: [39.40, -8.22], qatar: [25.35, 51.18],
  russia: [61.52, 105.32], seychelles: [-4.68, 55.49], singapore: [1.35, 103.82],
  south_africa: [-30.56, 22.94], spain: [40.46, -3.75], sri_lanka: [7.87, 80.77],
  sweden: [60.13, 18.64], thailand: [15.87, 100.99], turkey: [38.96, 35.24],
  united_arab_emirates: [23.42, 53.85], united_kingdom: [55.38, -3.44],
  united_states: [37.09, -95.71], vanuatu: [-15.38, 166.96], vietnam: [14.06, 108.28],
};

const normalizeMapText = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const countryKey = (value: string) => normalizeMapText(value).replace(/ /g, '_');

const locationCoordinate = (country: string, location: string): MarineMapCoordinate => {
  const normalizedLocation = normalizeMapText(location);
  const known = Object.entries(KNOWN_SITE_COORDINATES).find(([name]) => normalizedLocation.includes(name));
  if (known) return { latitude: known[1][0], longitude: known[1][1], precision: 'location' };
  const centroid = COUNTRY_CENTROIDS[countryKey(country)] || [0, 0];
  return { latitude: centroid[0], longitude: centroid[1], precision: 'country' };
};

@Injectable()
export class DivesService {
  diveRepository: any;
  constructor(
    @InjectRepository(Dive)
    private diveRepo: Repository<Dive>,

    @InjectRepository(DiveInvite)
    private diveInviteRepo: Repository<DiveInvite>,

    @InjectRepository(DiveBuddy)
    private diveBuddyRepo: Repository<DiveBuddy>,

    @InjectRepository(DiveSighting)
    private diveSightingRepo: Repository<DiveSighting>,

    @InjectRepository(DiveCenter)
    private diveCenterRepo: Repository<DiveCenter>,

    @InjectRepository(CenterLinkRequest)
    private centerLinkRequestRepo: Repository<CenterLinkRequest>,
  ) {}

  private async resolveCenter(centerId?: number) {
    if (!centerId) return null;
    const center = await this.diveCenterRepo.findOne({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Dive center not found');
    return center;
  }

  async createDive(dto: CreateDiveDto, creatorUserId: number) {
    // 1️⃣ Crear la inmersión (única)
    const dive = this.diveRepo.create({
      date: new Date(dto.date),
      country: dto.country,
      location: dto.location,
      maxDepth: dto.maxDepth,
      duration: dto.duration,
      notes: dto.notes,
      // A diver's selected center is a request, not an immediate association.
      // This keeps the center in control of accepting visits linked to its account.
      center: null,
      createdByUserId: creatorUserId,
    });

    const savedDive = await this.diveRepo.save(dive);

    // 2️⃣ Asociar al creador como buddy
    const buddy = this.diveBuddyRepo.create({
      diveId: savedDive.id,
      userId: creatorUserId,
    });

    await this.diveBuddyRepo.save(buddy);

    if (dto.sightings?.length) {
      await this.updateDiveSightings(savedDive.id, dto.sightings, creatorUserId);
    }

    if (dto.centerId) {
      await this.requestCenterLink(savedDive.id, dto.centerId, creatorUserId);
    }

    return savedDive;
  }

  getPokedexSpecies() {
    return POKEDEX_SPECIES;
  }

  async getPokedex(userId: number) {
    const memberships = await this.diveBuddyRepo.find({ where: { userId } });
    const diveIds = memberships.map((membership) => membership.diveId);
    const sightings = diveIds.length
      ? await this.diveSightingRepo.find({ where: { diveId: In(diveIds) } })
      : [];
    const counts = new Map<string, Set<number>>();

    sightings.forEach((sighting) => {
      if (!counts.has(sighting.speciesKey)) counts.set(sighting.speciesKey, new Set<number>());
      counts.get(sighting.speciesKey)?.add(sighting.diveId);
    });

    return POKEDEX_SPECIES.map((species) => ({
      ...species,
      sightingsCount: counts.get(species.key)?.size || 0,
    }));
  }

  async getMarineLifeMap(speciesKey?: string, period = 'all') {
    const validPeriods = new Set(['week', 'month', 'sixMonths', 'year', 'all']);
    const selectedPeriod = validPeriods.has(period) ? period : 'all';
    const selectedSpecies = speciesKey ? getSpecies(speciesKey) : undefined;
    if (speciesKey && !selectedSpecies) throw new BadRequestException('Especie no válida');

    const daysByPeriod: Record<string, number> = { week: 7, month: 30, sixMonths: 182, year: 365 };
    const since = daysByPeriod[selectedPeriod]
      ? new Date(Date.now() - daysByPeriod[selectedPeriod] * 24 * 60 * 60 * 1000)
      : null;
    // Filter at the database boundary so a large community does not require
    // every historical sighting to be loaded for each map interaction.
    const sightingsQuery = this.diveSightingRepo
      .createQueryBuilder('sighting')
      .innerJoinAndSelect('sighting.dive', 'dive')
      .orderBy('sighting.createdAt', 'DESC');
    if (selectedSpecies) sightingsQuery.andWhere('sighting.speciesKey = :speciesKey', { speciesKey: selectedSpecies.key });
    if (since) sightingsQuery.andWhere('dive.date >= :since', { since });
    sightingsQuery.andWhere('dive.date <= :now', { now: new Date() });
    const sightings = await sightingsQuery.getMany();
    const points = new Map<string, {
      latitude: number;
      longitude: number;
      precision: 'location' | 'country';
      country: string;
      location: string;
      sightings: number;
      dives: Set<number>;
      species: Map<string, number>;
      lastSeen: Date;
    }>();

    sightings.forEach((sighting) => {
      const species = getSpecies(sighting.speciesKey);
      const dive = sighting.dive;
      if (!species || !dive) return;
      const diveDate = new Date(dive.date);
      const coordinate = locationCoordinate(dive.country, dive.location);
      const key = `${coordinate.latitude.toFixed(3)}:${coordinate.longitude.toFixed(3)}:${normalizeMapText(dive.location)}`;
      const current = points.get(key) || {
        ...coordinate,
        country: dive.country,
        location: dive.location,
        sightings: 0,
        dives: new Set<number>(),
        species: new Map<string, number>(),
        lastSeen: diveDate,
      };
      current.sightings += 1;
      current.dives.add(dive.id);
      current.species.set(species.key, (current.species.get(species.key) || 0) + 1);
      if (diveDate > current.lastSeen) current.lastSeen = diveDate;
      points.set(key, current);
    });

    const serializedPoints = [...points.values()]
      .sort((a, b) => b.sightings - a.sightings || b.lastSeen.getTime() - a.lastSeen.getTime())
      .map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        precision: point.precision,
        country: point.country,
        location: point.location,
        sightings: point.sightings,
        dives: point.dives.size,
        lastSeen: point.lastSeen,
        species: [...point.species.entries()].map(([key, count]) => {
          const species = getSpecies(key);
          return species ? { ...species, count } : { key, count };
        }),
      }));
    return {
      period: selectedPeriod,
      speciesKey: selectedSpecies?.key || null,
      points: serializedPoints,
      totalSightings: serializedPoints.reduce((total, point) => total + point.sightings, 0),
      totalLocations: serializedPoints.length,
      generatedAt: new Date(),
    };
  }

  private async ensureDiveMember(diveId: number, userId: number) {
    const membership = await this.diveBuddyRepo.findOne({ where: { diveId, userId } });
    if (!membership) throw new ForbiddenException('No formas parte de esta inmersión');
  }

  async getDiveSightings(diveId: number, userId: number) {
    await this.ensureDiveAccess(diveId, userId);
    const sightings = await this.diveSightingRepo.find({ where: { diveId }, order: { createdAt: 'ASC' } });
    return sightings
      .map((sighting) => getSpecies(sighting.speciesKey))
      .filter((species): species is NonNullable<typeof species> => Boolean(species));
  }

  async updateDiveSightings(diveId: number, speciesKeys: string[], userId: number) {
    await this.ensureDiveAccess(diveId, userId);
    const requested = [...new Set(speciesKeys)].filter((key) => Boolean(getSpecies(key)));
    const existing = await this.diveSightingRepo.find({ where: { diveId } });
    const keep = new Set(requested);
    const remove = existing.filter((sighting) => !keep.has(sighting.speciesKey));
    if (remove.length) await this.diveSightingRepo.remove(remove);

    const existingKeys = new Set(existing.map((sighting) => sighting.speciesKey));
    const additions = requested
      .filter((key) => !existingKeys.has(key))
      .map((speciesKey) => this.diveSightingRepo.create({ diveId, speciesKey, createdByUserId: userId }));
    if (additions.length) await this.diveSightingRepo.save(additions);
    return this.getDiveSightings(diveId, userId);
  }

  async addSightingToDives(dto: AddSightingsToDivesDto, userId: number) {
    if (!getSpecies(dto.speciesKey)) throw new BadRequestException('Especie no válida');
    const diveIds = [...new Set(dto.diveIds)];
    if (!diveIds.length) throw new BadRequestException('Selecciona al menos una inmersión');

    const addedTo: number[] = [];
    for (const diveId of diveIds) {
      await this.ensureDiveMember(diveId, userId);
      const existing = await this.diveSightingRepo.findOne({ where: { diveId, speciesKey: dto.speciesKey } });
      if (!existing) {
        await this.diveSightingRepo.save(this.diveSightingRepo.create({ diveId, speciesKey: dto.speciesKey, createdByUserId: userId }));
        addedTo.push(diveId);
      }
    }
    return { speciesKey: dto.speciesKey, addedTo };
  }

  async inviteBuddy(
    diveId: number,
    invitedUserId: number,
    inviterUserId: number,
  ) {
    // 1️⃣ Comprobar que el invitador es buddy
    const inviterIsBuddy = await this.diveBuddyRepo.findOne({
      where: { diveId, userId: inviterUserId },
    });

    if (!inviterIsBuddy) {
      throw new ForbiddenException({
        message: 'No formas parte de esta inmersión',
      });
    }

    // 2️⃣ Comprobar que el invitado NO es ya buddy
    const invitedIsBuddy = await this.diveBuddyRepo.findOne({
      where: { diveId, userId: invitedUserId },
    });

    if (invitedIsBuddy) {
      throw new BadRequestException({
        message: 'El usuario ya está en la inmersión',
      });
    }

    // 3️⃣ Comprobar que no exista invitación pendiente
    const existingInvite = await this.diveInviteRepo.findOne({
      where: {
        diveId,
        invitedUserId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new BadRequestException({
        message: 'Ya se ha enviado una invitación',
      });
    }

    // 4️⃣ Crear invitación
    const invite = this.diveInviteRepo.create({
      diveId,
      invitedUserId,
      invitedByUserId: inviterUserId,
      status: InviteStatus.PENDING,
    });

    return this.diveInviteRepo.save(invite);
  }

  async acceptInvite(inviteId: number, userId: number) {
    // 1️⃣ Buscar invitación
    const invite = await this.diveInviteRepo.findOne({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // 2️⃣ Comprobar que el usuario es el invitado
    if (invite.invitedUserId !== userId) {
      throw new ForbiddenException('You are not allowed to accept this invite');
    }

    // 3️⃣ Comprobar estado
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is not pending');
    }

    // 4️⃣ Comprobar que no sea ya buddy (doble seguridad)
    const alreadyBuddy = await this.diveBuddyRepo.findOne({
      where: {
        diveId: invite.diveId,
        userId,
      },
    });

    if (alreadyBuddy) {
      throw new BadRequestException('User already joined this dive');
    }

    // 5️⃣ Crear relación DiveBuddy
    const buddy = this.diveBuddyRepo.create({
      diveId: invite.diveId,
      userId,
    });

    await this.diveBuddyRepo.save(buddy);

    // 6️⃣ Actualizar estado de invitación
    invite.status = InviteStatus.ACCEPTED;
    return this.diveInviteRepo.save(invite);
  }
  async rejectInvite(inviteId: number, userId: number) {
    // 1️⃣ Buscar invitación
    const invite = await this.diveInviteRepo.findOne({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // 2️⃣ Comprobar que el usuario es el invitado
    if (invite.invitedUserId !== userId) {
      throw new ForbiddenException('You are not allowed to reject this invite');
    }

    // 3️⃣ Comprobar estado
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is not pending');
    }

    // 4️⃣ Rechazar invitación
    invite.status = InviteStatus.REJECTED;
    return this.diveInviteRepo.save(invite);
  }
  async getPendingInvites(userId: number) {
    return this.diveInviteRepo.find({
      where: {
        invitedUserId: userId,
        status: InviteStatus.PENDING,
      },
      relations: ['dive'],
      order: {
        createdAt: 'DESC',
      },
    });
  }
  async getMyDives(userId: number) {
    const buddies = await this.diveBuddyRepo.find({
      where: { userId },
      relations: ['dive'],
      order: {
        joinedAt: 'DESC',
      },
    });

    return buddies.map((buddy) => buddy.dive);
  }
  async leaveDive(diveId: number, userId: number) {
    const dive = await this.diveRepo.findOne({
      where: { id: diveId },
      relations: ['buddies', 'buddies.user'], // 🔹 cargar el usuario de cada buddy
    });

    if (!dive) throw new NotFoundException('Inmersión no encontrada');

    // Encontrar el DiveBuddy que corresponde a este usuario
    const buddyIndex = dive.buddies.findIndex((b) => b.user.id === userId);
    if (buddyIndex === -1)
      throw new ForbiddenException('No formas parte de esta inmersión');

    // Eliminarlo
    await this.diveBuddyRepo.remove(dive.buddies[buddyIndex]);

    return { message: 'Has salido de la inmersión' };
  }

  private async ensureDiveAccess(diveId: number, userId: number) {
    const membership = await this.diveBuddyRepo.findOne({ where: { diveId, userId } });
    if (membership) return;
    const dive = await this.diveRepo.findOne({ where: { id: diveId } });
    if (dive?.center) {
      const center = await this.diveCenterRepo.findOne({ where: { id: dive.center.id, ownerUserId: userId } });
      if (center) return;
    }
    throw new ForbiddenException('You do not have access to this dive');
  }

  private async canEditDive(dive: Dive, userId: number) {
    if (dive.createdByUserId === userId) return true;
    if (dive.createdByUserId !== null) return false;
    const firstBuddy = await this.diveBuddyRepo.findOne({ where: { diveId: dive.id }, order: { joinedAt: 'ASC' } });
    return firstBuddy?.userId === userId;
  }

  async getDive(diveId: number, userId: number) {
    await this.ensureDiveAccess(diveId, userId);
    const dive = await this.diveRepo.findOne({ where: { id: diveId } });
    if (!dive) throw new NotFoundException('Dive not found');
    return { ...dive, canEdit: await this.canEditDive(dive, userId) };
  }

  async updateDive(diveId: number, dto: UpdateDiveDto, userId: number) {
    const dive = await this.diveRepo.findOne({ where: { id: diveId } });
    if (!dive) throw new NotFoundException('Dive not found');
    if (!(await this.canEditDive(dive, userId))) throw new ForbiddenException('Only the dive creator can edit it');
    Object.assign(dive, dto, dto.date ? { date: new Date(dto.date) } : {}, dto.location !== undefined ? { location: dto.location.trim() } : {}, dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {});
    const saved = await this.diveRepo.save(dive);
    return { ...saved, canEdit: true };
  }

  async linkCenter(diveId: number, centerId: number | null, userId: number) {
    await this.ensureDiveAccess(diveId, userId);
    const dive = await this.diveRepo.findOne({ where: { id: diveId } });
    if (!dive) throw new NotFoundException('Dive not found');
    const center = centerId ? await this.resolveCenter(centerId) : null;
    if (center && center.ownerUserId !== userId) throw new ForbiddenException('The dive center must accept a link request before this dive is linked');
    dive.center = center;
    return this.diveRepo.save(dive);
  }

  async requestCenterLink(diveId: number, centerId: number, userId: number, message?: string) {
    await this.ensureDiveAccess(diveId, userId);
    const center = await this.resolveCenter(centerId);
    if (!center) throw new NotFoundException('Dive center not found');
    const dive = await this.diveRepo.findOne({ where: { id: diveId } });
    if (!dive) throw new NotFoundException('Dive not found');
    if (dive.center?.id === center.id) throw new BadRequestException('This dive is already linked to this center');
    if (dive.center && dive.center.id !== center.id) throw new BadRequestException('This dive is already linked to another center');
    const pending = await this.centerLinkRequestRepo.findOne({
      where: { diveId, centerId, status: CenterLinkRequestStatus.PENDING },
    });
    if (pending) throw new BadRequestException('A center link request is already pending');
    const request = this.centerLinkRequestRepo.create({
      diveId,
      centerId: center.id,
      requestedByUserId: userId,
      message: message?.trim() || null,
      status: CenterLinkRequestStatus.PENDING,
    });
    return this.centerLinkRequestRepo.save(request);
  }

  async getCenterLinkRequestsForDive(diveId: number, userId: number) {
    await this.ensureDiveAccess(diveId, userId);
    const requests = await this.centerLinkRequestRepo.find({
      where: { diveId },
      relations: ['center'],
      order: { createdAt: 'DESC' },
    });
    return requests.map((request) => ({
      id: request.id,
      diveId: request.diveId,
      centerId: request.centerId,
      requestedByUserId: request.requestedByUserId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      center: request.center,
    }));
  }

  async getDiveBuddies(diveId: number) {
    const buddies = await this.diveBuddyRepo.find({
      where: { diveId },
      relations: ['user'],
      order: {
        joinedAt: 'ASC',
      },
    });

    // Devolver solo la info necesaria
    return buddies.map((b) => ({
      userId: b.userId,
      name: b.user.name,
      email: b.user.email,
      joinedAt: b.joinedAt,
    }));
  }
  async getMyPersonalNotes(diveId: number, userId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const relation = await this.diveBuddyRepo.findOne({
      where: {
        diveId,
        userId,
      },
    });

    if (!relation) {
      throw new NotFoundException('No estás en esta inmersión');
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      notes: relation.personalNotes ?? '',
    };
  }
  async updatePersonalNotes(diveId: number, userId: number, notes: string) {
    const buddy = await this.diveBuddyRepo.findOne({
      where: {
        dive: { id: diveId },
        user: { id: userId },
      },
    });

    if (!buddy) {
      throw new NotFoundException('No participas en esta inmersión');
    }

    buddy.personalNotes = notes;
    return this.diveBuddyRepo.save(buddy);
  }
}
