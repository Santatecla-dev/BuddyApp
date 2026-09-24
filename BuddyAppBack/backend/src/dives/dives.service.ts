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
import { NotificationsService } from '../notifications/notifications.service';

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
    private notificationsService: NotificationsService,
  ) {}

  private async notifyDiveBuddiesOfSightings(diveId: number, actorId: number, speciesKeys: string[]) {
    if (!speciesKeys.length) return;
    const buddies = await this.diveBuddyRepo.find({ where: { diveId } });
    const names = speciesKeys.map((key) => getSpecies(key)?.name || key).slice(0, 3);
    const suffix = names.join(', ');
    await Promise.all(buddies.filter((buddy) => buddy.userId !== actorId).map((buddy) => this.notificationsService.create({
      recipientId: buddy.userId,
      actorId,
      type: 'sighting',
      title: 'New marine life sighting',
      body: `A buddy added ${suffix} to a dive you share.`,
      entityType: 'dive',
      entityId: String(diveId),
      dedupeKey: `sighting:${diveId}:${actorId}:${speciesKeys.slice().sort().join('|')}`,
    })));
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

  private async ensureDiveMember(diveId: number, userId: number) {
    const membership = await this.diveBuddyRepo.findOne({ where: { diveId, userId } });
    if (!membership) throw new ForbiddenException('No formas parte de esta inmersión');
  }

  async getDiveSightings(diveId: number, userId: number) {
    await this.ensureDiveMember(diveId, userId);
    const sightings = await this.diveSightingRepo.find({ where: { diveId }, order: { createdAt: 'ASC' } });
    return sightings
      .map((sighting) => getSpecies(sighting.speciesKey))
      .filter((species): species is NonNullable<typeof species> => Boolean(species));
  }

  async updateDiveSightings(diveId: number, speciesKeys: string[], userId: number) {
    await this.ensureDiveMember(diveId, userId);
    const requested = [...new Set(speciesKeys)].filter((key) => Boolean(getSpecies(key)));
    const existing = await this.diveSightingRepo.find({ where: { diveId } });
    const keep = new Set(requested);
    const remove = existing.filter((sighting) => !keep.has(sighting.speciesKey));
    if (remove.length) await this.diveSightingRepo.remove(remove);

    const existingKeys = new Set(existing.map((sighting) => sighting.speciesKey));
    const additions = requested
      .filter((key) => !existingKeys.has(key))
      .map((speciesKey) => this.diveSightingRepo.create({ diveId, speciesKey, createdByUserId: userId }));
    if (additions.length) {
      await this.diveSightingRepo.save(additions);
      await this.notifyDiveBuddiesOfSightings(diveId, userId, additions.map((sighting) => sighting.speciesKey));
    }
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
        await this.notifyDiveBuddiesOfSightings(diveId, userId, [dto.speciesKey]);
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

    const savedInvite = await this.diveInviteRepo.save(invite);
    await this.notificationsService.create({
      recipientId: invitedUserId,
      actorId: inviterUserId,
      type: 'invite',
      title: 'New dive invitation',
      body: 'A buddy invited you to join a dive.',
      entityType: 'invite',
      entityId: String(savedInvite.id),
      dedupeKey: `invite:${savedInvite.id}`,
    });
    return savedInvite;
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
    const savedInvite = await this.diveInviteRepo.save(invite);
    await this.notificationsService.create({
      recipientId: invite.invitedByUserId,
      actorId: userId,
      type: 'invite_accepted',
      title: 'Dive invitation accepted',
      body: 'Your buddy accepted a dive invitation.',
      entityType: 'dive',
      entityId: String(invite.diveId),
      dedupeKey: `invite-accepted:${invite.id}`,
    });
    return savedInvite;
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
    const savedInvite = await this.diveInviteRepo.save(invite);
    await this.notificationsService.create({
      recipientId: invite.invitedByUserId,
      actorId: userId,
      type: 'invite_rejected',
      title: 'Dive invitation declined',
      body: 'Your buddy declined a dive invitation.',
      entityType: 'dive',
      entityId: String(invite.diveId),
      dedupeKey: `invite-rejected:${invite.id}`,
    });
    return savedInvite;
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
