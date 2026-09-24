import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Dive } from '../dives/dive.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { PlannedDive } from '../dives/planned-dive.entity';
import { User } from '../users/user.entity';
import { CenterInventoryItem } from './center-inventory-item.entity';
import { DiveCenter } from './dive-center.entity';
import { CenterLinkRequest, CenterLinkRequestStatus } from './center-link-request.entity';
import { DiveInvite, InviteStatus } from '../dives/dive-invite.entity';
import { CreateCenterDiveDto } from './dto/create-center-dive.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateInventoryBulkDto } from './dto/create-inventory-bulk.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { UpdateCenterProfileDto } from './dto/update-center-profile.dto';

@Injectable()
export class CentersService {
  constructor(
    @InjectRepository(DiveCenter) private readonly centersRepo: Repository<DiveCenter>,
    @InjectRepository(CenterInventoryItem) private readonly inventoryRepo: Repository<CenterInventoryItem>,
    @InjectRepository(Dive) private readonly diveRepo: Repository<Dive>,
    @InjectRepository(PlannedDive) private readonly plannedRepo: Repository<PlannedDive>,
    @InjectRepository(DiveBuddy) private readonly buddyRepo: Repository<DiveBuddy>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(DiveInvite) private readonly invitesRepo: Repository<DiveInvite>,
    @InjectRepository(CenterLinkRequest) private readonly linkRequestsRepo: Repository<CenterLinkRequest>,
  ) {}

  async forOwner(userId: number) {
    const center = await this.centersRepo.findOne({ where: { ownerUserId: userId } });
    if (!center) throw new ForbiddenException('This account is not linked to a dive center');
    return center;
  }

  async publicList(search?: string) {
    const normalized = search?.trim();
    return this.centersRepo.find({
      where: normalized ? [{ name: ILike(`%${normalized}%`) }, { city: ILike(`%${normalized}%`) }, { country: ILike(`%${normalized}%`) }] : {},
      order: { name: 'ASC' },
      take: 50,
      select: ['id', 'name', 'slug', 'description', 'city', 'country', 'verified'],
    });
  }

  async publicGet(id: number) {
    const center = await this.centersRepo.findOne({
      where: { id },
      select: ['id', 'name', 'slug', 'description', 'city', 'country', 'email', 'phone', 'website', 'verified'],
    });
    if (!center) throw new NotFoundException('Dive center not found');
    return center;
  }

  async dashboard(userId: number) {
    const center = await this.forOwner(userId);
    const [dives, plannedDives, inventory, clients, linkRequests] = await Promise.all([
      this.diveRepo.find({ where: { center: { id: center.id } }, order: { date: 'DESC' }, take: 50 }),
      this.plannedRepo.find({ where: { center: { id: center.id }, status: 'upcoming' }, order: { date: 'ASC' }, take: 50 }),
      this.inventoryRepo.find({ where: { centerId: center.id }, order: { category: 'ASC', name: 'ASC' } }),
      this.listClientsForCenter(center.id),
      this.listLinkRequestsForCenter(center.id),
    ]);
    return { center, dives, plannedDives, inventory, clients, linkRequests, counts: { dives: dives.length, plannedDives: plannedDives.length, inventory: inventory.length, clients: clients.length } };
  }

  async profile(userId: number) {
    const center = await this.forOwner(userId);
    const [loggedDives, plannedDives, inventory, clients] = await Promise.all([
      this.diveRepo.count({ where: { center: { id: center.id } } }),
      this.plannedRepo.count({ where: { center: { id: center.id }, status: 'upcoming' } }),
      this.inventoryRepo.find({ where: { centerId: center.id } }),
      this.listClientsForCenter(center.id),
    ]);
    const inventoryUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const availableUnits = inventory.filter((item) => item.status === 'available').reduce((sum, item) => sum + item.quantity, 0);
    const clientRanking = [...clients].sort((a, b) => b.dives - a.dives || a.name.localeCompare(b.name)).slice(0, 10);
    return {
      center,
      stats: { loggedDives, plannedDives, clients: clients.length, assetTypes: inventory.length, inventoryUnits, availableUnits },
      clientsPreview: clients.slice(0, 5),
      clientRanking,
      createdAt: center.createdAt,
      updatedAt: center.updatedAt,
    };
  }

  async updateProfile(userId: number, dto: UpdateCenterProfileDto) {
    const center = await this.forOwner(userId);
    const values = Object.fromEntries(Object.entries(dto).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    Object.assign(center, values);
    return this.centersRepo.save(center);
  }

  async createDive(userId: number, dto: CreateCenterDiveDto) {
    const center = await this.forOwner(userId);
    const participantIds = [...new Set([userId, ...(dto.buddyUserIds || [])])];
    const users = participantIds.length ? await this.usersRepo.findBy({ id: In(participantIds) }) : [];
    if (users.length !== participantIds.length) throw new BadRequestException('One or more buddy accounts could not be found');
    if (users.some((user) => user.accountType === 'center' && user.id !== userId)) throw new BadRequestException('Only diver accounts can be invited as buddies');
    const dive = this.diveRepo.create({
      date: new Date(dto.date),
      country: dto.country,
      location: dto.location.trim(),
      maxDepth: dto.maxDepth,
      duration: dto.duration,
      notes: dto.notes?.trim() || undefined,
      center,
      createdByUserId: userId,
    });
    const saved = await this.diveRepo.save(dive);
    // The center is the initial participant; invited divers join only after accepting.
    await this.buddyRepo.save(this.buddyRepo.create({ diveId: saved.id, userId }));

    const invitees = participantIds.filter((participantId) => participantId !== userId);
    if (invitees.length) {
      await this.invitesRepo.save(invitees.map((invitedUserId) => this.invitesRepo.create({
        diveId: saved.id,
        invitedUserId,
        invitedByUserId: userId,
        status: InviteStatus.PENDING,
      })));
    }
    return this.diveRepo.findOne({ where: { id: saved.id } });
  }

  private async listLinkRequestsForCenter(centerId: number) {
    const requests = await this.linkRequestsRepo.find({
      where: { centerId, status: CenterLinkRequestStatus.PENDING },
      relations: ['dive'],
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
      dive: request.dive,
      requestedBy: request.requestedBy ? { id: request.requestedBy.id, name: request.requestedBy.name, email: request.requestedBy.email } : undefined,
    }));
  }

  async listLinkRequests(userId: number) {
    const center = await this.forOwner(userId);
    return this.listLinkRequestsForCenter(center.id);
  }

  async respondToLinkRequest(id: number, userId: number, accept: boolean) {
    const center = await this.forOwner(userId);
    const request = await this.linkRequestsRepo.findOne({
      where: { id, centerId: center.id },
      relations: ['dive'],
    });
    if (!request) throw new NotFoundException('Center link request not found');
    if (request.status !== CenterLinkRequestStatus.PENDING) throw new BadRequestException('This request has already been answered');
    if (accept) {
      if (request.dive.center && request.dive.center.id !== center.id) throw new BadRequestException('This dive is already linked to another center');
      request.dive.center = center;
      await this.diveRepo.save(request.dive);
      request.status = CenterLinkRequestStatus.ACCEPTED;
    } else {
      request.status = CenterLinkRequestStatus.REJECTED;
    }
    request.respondedAt = new Date();
    const saved = await this.linkRequestsRepo.save(request);
    return {
      id: saved.id,
      diveId: saved.diveId,
      centerId: saved.centerId,
      requestedByUserId: saved.requestedByUserId,
      status: saved.status,
      message: saved.message,
      createdAt: saved.createdAt,
      respondedAt: saved.respondedAt,
    };
  }

  async listInventory(userId: number) {
    const center = await this.forOwner(userId);
    return this.inventoryRepo.find({ where: { centerId: center.id }, order: { category: 'ASC', name: 'ASC' } });
  }

  async createInventory(userId: number, dto: CreateInventoryItemDto) {
    const center = await this.forOwner(userId);
    return this.inventoryRepo.save(this.inventoryRepo.create({
      centerId: center.id,
      name: dto.name.trim(),
      category: dto.category.trim(),
      quantity: dto.quantity ?? 1,
      status: dto.status || 'available',
      location: dto.location?.trim() || null,
      notes: dto.notes?.trim() || null,
      nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null,
    }));
  }

  async createInventoryBulk(userId: number, dto: CreateInventoryBulkDto) {
    const center = await this.forOwner(userId);
    const baseName = dto.name.trim();
    const items = Array.from({ length: dto.count }, (_, index) => this.inventoryRepo.create({
      centerId: center.id,
      name: `${baseName} #${index + 1}`,
      category: dto.category.trim(),
      quantity: 1,
      status: dto.status || 'available',
      location: dto.location?.trim() || null,
      notes: dto.notes?.trim() || null,
      nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null,
    }));
    return this.inventoryRepo.save(items);
  }

  private async ownedInventory(id: number, userId: number) {
    const center = await this.forOwner(userId);
    const item = await this.inventoryRepo.findOne({ where: { id, centerId: center.id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async updateInventory(id: number, userId: number, dto: UpdateInventoryItemDto) {
    const item = await this.ownedInventory(id, userId);
    Object.assign(item, dto, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
      ...(dto.location !== undefined ? { location: dto.location.trim() || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      ...(dto.nextServiceDate !== undefined ? { nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null } : {}),
    });
    return this.inventoryRepo.save(item);
  }

  async removeInventory(id: number, userId: number) {
    const item = await this.ownedInventory(id, userId);
    await this.inventoryRepo.remove(item);
    return { deleted: true };
  }

  async listClients(userId: number) {
    const center = await this.forOwner(userId);
    return this.listClientsForCenter(center.id);
  }

  private async listClientsForCenter(centerId: number) {
    const memberships = await this.buddyRepo.createQueryBuilder('membership')
      .leftJoinAndSelect('membership.user', 'user')
      .leftJoinAndSelect('membership.dive', 'dive')
      .where('dive.centerId = :centerId', { centerId })
      .orderBy('dive.date', 'DESC')
      .getMany();
    const clients = new Map<number, { id: number; name: string; email: string; dives: number; lastDive: Date | null }>();
    memberships.forEach((membership) => {
      const user = membership.user;
      if (!user || user.accountType === 'center') return;
      const current = clients.get(user.id);
      const diveDate = membership.dive?.date || null;
      if (current) {
        current.dives += 1;
        if (diveDate && (!current.lastDive || new Date(diveDate) > new Date(current.lastDive))) current.lastDive = diveDate;
      } else {
        clients.set(user.id, { id: user.id, name: user.name, email: user.email, dives: 1, lastDive: diveDate });
      }
    });
    return [...clients.values()];
  }
}
