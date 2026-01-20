// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dive } from './dive.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { CreateDiveDto } from './dto/create-dive.dto';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DiveInvite, InviteStatus } from './dive-invite.entity';

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
  ) {}

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

    return savedDive;
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
