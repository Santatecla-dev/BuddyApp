import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreatePlannedDiveDto } from './dto/create-planned-dive.dto';
import { UpdatePlannedDiveDto } from './dto/update-planned-dive.dto';
import { Dive } from './dive.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { PlannedDive } from './planned-dive.entity';
import { DiveCenter } from '../centers/dive-center.entity';
import { CenterInventoryItem } from '../centers/center-inventory-item.entity';
import { DiveSite } from '../centers/dive-site.entity';
import { PlannedDiveInvite, PlannedInviteStatus } from './planned-dive-invite.entity';
import { PlannedDiveBuddy } from './planned-dive-buddy.entity';
import { User } from '../users/user.entity';
import { CreateCenterPlannedDiveDto } from './dto/create-center-planned-dive.dto';
import { PlannedDiveRosterRequest, RosterRequestStatus } from './planned-dive-roster-request.entity';

@Injectable()
export class PlannedDivesService {
  constructor(
    @InjectRepository(PlannedDive) private readonly plannedRepo: Repository<PlannedDive>,
    @InjectRepository(Dive) private readonly diveRepo: Repository<Dive>,
    @InjectRepository(DiveBuddy) private readonly diveBuddyRepo: Repository<DiveBuddy>,
    @InjectRepository(DiveCenter) private readonly diveCenterRepo: Repository<DiveCenter>,
    @InjectRepository(PlannedDiveInvite) private readonly inviteRepo: Repository<PlannedDiveInvite>,
    @InjectRepository(PlannedDiveBuddy) private readonly buddyRepo: Repository<PlannedDiveBuddy>,
    @InjectRepository(PlannedDiveRosterRequest) private readonly rosterRequestRepo: Repository<PlannedDiveRosterRequest>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(CenterInventoryItem) private readonly inventoryRepo: Repository<CenterInventoryItem>,
    @InjectRepository(DiveSite) private readonly diveSitesRepo: Repository<DiveSite>,
  ) {}

  private async resolveCenter(centerId?: number) {
    if (!centerId) return null;
    const center = await this.diveCenterRepo.findOne({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Dive center not found');
    return center;
  }

  async list(userId: number) {
    const [owned, memberships] = await Promise.all([
      this.plannedRepo.find({ where: { userId, status: 'upcoming' }, order: { date: 'ASC', createdAt: 'DESC' } }),
      this.buddyRepo.find({ where: { userId }, relations: ['plannedDive'] }),
    ]);
    const shared = memberships.map((membership) => membership.plannedDive).filter((plan) => plan?.status === 'upcoming');
    return [...new Map([...owned, ...shared].map((plan) => [plan.id, plan])).values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async get(id: number, userId: number) {
    const plan = await this.plannedRepo.findOne({ where: { id, userId } });
    if (plan) return plan;
    const membership = await this.buddyRepo.findOne({ where: { plannedDiveId: id, userId }, relations: ['plannedDive'] });
    if (!membership?.plannedDive) throw new NotFoundException('Planned dive not found');
    return membership.plannedDive;
  }

  async listCenterRosters(userId: number, search?: string) {
    const normalized = search?.trim().toLowerCase();
    const query = this.plannedRepo.createQueryBuilder('plan')
      .leftJoinAndSelect('plan.center', 'center')
      .where('plan.status = :status', { status: 'upcoming' })
      .andWhere('plan.date >= :today', { today: new Date() })
      .andWhere('center.id IS NOT NULL')
      .andWhere('plan.isPublic = :isPublic', { isPublic: true })
      .orderBy('plan.date', 'ASC')
      .addOrderBy('plan.createdAt', 'DESC')
      .take(100);
    if (normalized) {
      query.andWhere('(LOWER(center.name) LIKE :search OR LOWER(center.city) LIKE :search OR LOWER(center.country) LIKE :search OR LOWER(plan.location) LIKE :search)', { search: `%${normalized}%` });
    }
    const plans = await query.getMany();
    return Promise.all(plans.map(async (plan) => {
      const [members, request] = await Promise.all([
        this.buddyRepo.count({ where: { plannedDiveId: plan.id } }),
        this.rosterRequestRepo.findOne({ where: { plannedDiveId: plan.id, userId }, order: { createdAt: 'DESC' } }),
      ]);
      return { ...plan, roster: { joined: members, capacity: plan.capacity || 12, requestStatus: request?.status || null } };
    }));
  }

  async requestRosterJoin(id: number, userId: number, message?: string) {
    const plan = await this.plannedRepo.findOne({ where: { id }, relations: ['center'] });
    if (!plan || plan.status !== 'upcoming' || !plan.center || !plan.isPublic) throw new NotFoundException('Center roster not found');
    if (plan.userId === userId) throw new BadRequestException('The roster owner cannot request a place');
    const joined = await this.buddyRepo.findOne({ where: { plannedDiveId: id, userId } });
    if (joined) throw new BadRequestException('You are already on this roster');
    const existing = await this.rosterRequestRepo.findOne({ where: { plannedDiveId: id, userId } });
    if (existing?.status === RosterRequestStatus.PENDING) throw new BadRequestException('A place request is already pending');
    const request = existing || this.rosterRequestRepo.create({ plannedDiveId: id, userId, status: RosterRequestStatus.PENDING, message: null, respondedAt: null });
    request.status = RosterRequestStatus.PENDING;
    request.message = message?.trim() || null;
    request.respondedAt = null;
    return this.rosterRequestRepo.save(request);
  }

  async listCenterRosterRequests(userId: number) {
    const center = await this.diveCenterRepo.findOne({ where: { ownerUserId: userId } });
    if (!center) throw new ForbiddenException('This account is not linked to a dive center');
    return this.rosterRequestRepo.find({
      where: { status: RosterRequestStatus.PENDING, plannedDive: { center: { id: center.id } } },
      relations: ['plannedDive', 'plannedDive.center'],
      order: { createdAt: 'ASC' },
    });
  }

  async respondToRosterRequest(id: number, userId: number, accept: boolean) {
    const center = await this.diveCenterRepo.findOne({ where: { ownerUserId: userId } });
    if (!center) throw new ForbiddenException('This account is not linked to a dive center');
    const request = await this.rosterRequestRepo.findOne({ where: { id }, relations: ['plannedDive', 'plannedDive.center', 'user'] });
    if (!request || request.plannedDive.center?.id !== center.id) throw new NotFoundException('Roster request not found');
    if (request.status !== RosterRequestStatus.PENDING) throw new BadRequestException('This roster request has already been answered');
    if (accept) {
      const joined = await this.buddyRepo.count({ where: { plannedDiveId: request.plannedDiveId } });
      if (joined >= (request.plannedDive.capacity || 12)) throw new BadRequestException('This roster is already full');
      const alreadyJoined = await this.buddyRepo.findOne({ where: { plannedDiveId: request.plannedDiveId, userId: request.userId } });
      if (!alreadyJoined) await this.buddyRepo.save(this.buddyRepo.create({ plannedDiveId: request.plannedDiveId, userId: request.userId }));
      request.status = RosterRequestStatus.ACCEPTED;
    } else {
      request.status = RosterRequestStatus.DECLINED;
    }
    request.respondedAt = new Date();
    const saved = await this.rosterRequestRepo.save(request);
    return { id: saved.id, plannedDiveId: saved.plannedDiveId, userId: saved.userId, status: saved.status, respondedAt: saved.respondedAt };
  }

  private async getOwned(id: number, userId: number) {
    const plan = await this.plannedRepo.findOne({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Only the planned dive owner can change it');
    return plan;
  }

  async create(dto: CreatePlannedDiveDto, userId: number) {
    const date = new Date(dto.date);
    if (date.getTime() < Date.now() - 86400000) throw new BadRequestException('A planned dive must be today or in the future');
    return this.plannedRepo.save(this.plannedRepo.create({ ...dto, userId, date, notes: dto.notes || null, checklist: dto.checklist || {}, status: 'upcoming', center: await this.resolveCenter(dto.centerId) }));
  }

  async createForCenter(dto: CreateCenterPlannedDiveDto, userId: number) {
    const center = await this.diveCenterRepo.findOne({ where: { ownerUserId: userId } });
    if (!center) throw new ForbiddenException('This account is not linked to a dive center');
    if (dto.diveSiteId !== undefined) {
      const diveSite = await this.diveSitesRepo.findOne({ where: { id: dto.diveSiteId, centerId: center.id } });
      if (!diveSite) throw new BadRequestException('The selected dive site does not belong to this center.');
    }
    const requestedInventory = dto.inventoryAllocations || [];
    const inventoryIds = [...new Set(requestedInventory.map((allocation) => Number(allocation.inventoryId)).filter((id) => Number.isInteger(id) && id > 0))];
    const inventory = inventoryIds.length ? await this.inventoryRepo.find({ where: { id: In(inventoryIds), centerId: center.id } }) : [];
    if (inventory.length !== inventoryIds.length) throw new BadRequestException('One or more selected inventory items do not belong to this center');
    const inventoryById = new Map(inventory.map((item) => [item.id, item]));
    const inventoryAllocations = requestedInventory.map((allocation) => {
      const inventoryId = Number(allocation.inventoryId);
      const item = inventoryById.get(inventoryId);
      const quantity = Number(allocation.quantity);
      if (!item || item.status !== 'available' || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
        throw new BadRequestException(`Invalid allocation for inventory item ${inventoryId}`);
      }
      return { inventoryId, quantity, reserved: allocation.reserved === true };
    });
    const participantIds = [...new Set(dto.buddyUserIds || [])];
    const users = participantIds.length ? await this.usersRepo.findBy({ id: In(participantIds) }) : [];
    if (users.length !== participantIds.length || users.some((user) => user.accountType === 'center')) throw new BadRequestException('Only existing diver accounts can be invited');
    const plan = await this.create({ ...dto, centerId: center.id, inventoryAllocations }, userId);
    if (participantIds.length) await this.inviteRepo.save(participantIds.map((invitedUserId) => this.inviteRepo.create({ plannedDiveId: plan.id, invitedUserId, invitedByUserId: userId, status: PlannedInviteStatus.PENDING })));
    return plan;
  }

  async update(id: number, dto: UpdatePlannedDiveDto, userId: number) {
    const plan = await this.getOwned(id, userId);
    if (dto.date && new Date(dto.date).getTime() < Date.now() - 86400000) throw new BadRequestException('A planned dive must be today or in the future');
    Object.assign(plan, dto, dto.date ? { date: new Date(dto.date) } : {}, dto.centerId !== undefined ? { center: await this.resolveCenter(dto.centerId) } : {});
    return this.plannedRepo.save(plan);
  }

  async remove(id: number, userId: number) {
    const plan = await this.getOwned(id, userId);
    await this.plannedRepo.remove(plan);
    return { deleted: true };
  }

  async log(id: number, userId: number) {
    const plan = await this.getOwned(id, userId);
    if (plan.status !== 'upcoming') {
      throw new BadRequestException('This planned dive has already been logged or cancelled');
    }
    const dive = await this.diveRepo.save(this.diveRepo.create({
      date: plan.date,
      country: plan.country,
      location: plan.location,
      maxDepth: plan.maxDepth,
      duration: plan.duration,
      notes: plan.notes || undefined,
      center: plan.center,
    }));
    const accepted = await this.buddyRepo.find({ where: { plannedDiveId: plan.id } });
    const participantIds = [...new Set([userId, ...accepted.map((membership) => membership.userId)])];
    await this.diveBuddyRepo.save(participantIds.map((participantId) => this.diveBuddyRepo.create({ diveId: dive.id, userId: participantId })));
    plan.status = 'logged';
    await this.plannedRepo.save(plan);
    return dive;
  }

  async pendingInvites(userId: number) {
    const invites = await this.inviteRepo.find({ where: { invitedUserId: userId, status: PlannedInviteStatus.PENDING }, relations: ['plannedDive'], order: { createdAt: 'DESC' } });
    return invites.map((invite) => ({ id: invite.id, plannedDive: invite.plannedDive, invitedByUser: invite.invitedByUser ? { id: invite.invitedByUser.id, name: invite.invitedByUser.name, email: invite.invitedByUser.email } : undefined, status: invite.status, createdAt: invite.createdAt }));
  }

  async respondInvite(id: number, userId: number, accept: boolean) {
    const invite = await this.inviteRepo.findOne({ where: { id, invitedUserId: userId }, relations: ['plannedDive'] });
    if (!invite) throw new NotFoundException('Planned dive invitation not found');
    if (invite.status !== PlannedInviteStatus.PENDING) throw new BadRequestException('Invitation is no longer pending');
    invite.status = accept ? PlannedInviteStatus.ACCEPTED : PlannedInviteStatus.REJECTED;
    if (accept) await this.buddyRepo.save(this.buddyRepo.create({ plannedDiveId: invite.plannedDiveId, userId }));
    const saved = await this.inviteRepo.save(invite);
    return { id: saved.id, plannedDiveId: saved.plannedDiveId, status: saved.status, createdAt: saved.createdAt };
  }
}
