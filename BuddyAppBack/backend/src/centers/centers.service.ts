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
import { WarehouseMap } from './warehouse-map.entity';
import { WarehouseObject } from './warehouse-object.entity';
import { CreateWarehouseObjectDto } from './dto/create-warehouse-object.dto';
import { UpdateWarehouseObjectDto } from './dto/update-warehouse-object.dto';
import { UpdateWarehouseMapDto } from './dto/update-warehouse-map.dto';

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
    @InjectRepository(WarehouseMap) private readonly warehouseMapsRepo: Repository<WarehouseMap>,
    @InjectRepository(WarehouseObject) private readonly warehouseObjectsRepo: Repository<WarehouseObject>,
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

  async getWarehouse(userId: number) {
    const center = await this.forOwner(userId);
    let map = await this.warehouseMapsRepo.findOne({ where: { centerId: center.id } });
    if (!map) map = await this.warehouseMapsRepo.save(this.warehouseMapsRepo.create({ centerId: center.id, name: 'Main warehouse', width: 24, height: 16 }));
    const [objects, inventory] = await Promise.all([
      this.warehouseObjectsRepo.find({ where: { mapId: map.id }, order: { y: 'ASC', x: 'ASC' } }),
      this.inventoryRepo.find({ where: { centerId: center.id }, order: { category: 'ASC', name: 'ASC' } }),
    ]);
    return { map, objects, inventory };
  }

  async clearWarehouse(userId: number) {
    const center = await this.forOwner(userId);
    const map = await this.warehouseMapsRepo.findOne({ where: { centerId: center.id } });
    if (!map) return { deleted: 0 };
    const objects = await this.warehouseObjectsRepo.find({ where: { mapId: map.id } });
    await this.inventoryRepo.update({ centerId: center.id }, { warehouseObjectId: null });
    if (objects.length) await this.warehouseObjectsRepo.remove(objects);
    return { deleted: objects.length };
  }

  async updateWarehouse(userId: number, dto: UpdateWarehouseMapDto) {
    const center = await this.forOwner(userId);
    const map = await this.warehouseMapsRepo.findOne({ where: { centerId: center.id } });
    if (!map) throw new NotFoundException('Warehouse map not found');
    const nextWidth = dto.width ?? map.width;
    const nextHeight = dto.height ?? map.height;
    const objects = await this.warehouseObjectsRepo.find({ where: { mapId: map.id } });
    if (objects.some((object) => {
      const bounds = this.rotatedBounds(object);
      return object.x + bounds.width > nextWidth || object.y + bounds.height > nextHeight;
    })) {
      throw new BadRequestException('The new warehouse dimensions would cut off one or more objects. Move them first.');
    }
    Object.assign(map, dto, { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) });
    return this.warehouseMapsRepo.save(map);
  }

  private rotatedBounds(object: WarehouseObject) {
    const angle = ((object.rotation ?? 0) % 180 + 180) % 180;
    if (angle === 90) return { width: object.height, height: object.width };
    if (angle === 45 || angle === 135) {
      const diagonal = Math.ceil((object.width + object.height) / Math.sqrt(2));
      return { width: diagonal, height: diagonal };
    }
    return { width: object.width, height: object.height };
  }

  private assertWarehouseObjectFits(candidate: WarehouseObject, map: WarehouseMap, objects: WarehouseObject[]) {
    const candidateBounds = this.rotatedBounds(candidate);
    if (candidate.x < 0 || candidate.y < 0 || candidate.width < 1 || candidate.height < 1 || candidate.x + candidateBounds.width > map.width || candidate.y + candidateBounds.height > map.height) {
      throw new BadRequestException('This object must stay inside the warehouse boundaries.');
    }
    const overlaps = objects.some((other) => other.id !== candidate.id
      && candidate.x < other.x + this.rotatedBounds(other).width
      && candidate.x + candidateBounds.width > other.x
      && candidate.y < other.y + this.rotatedBounds(other).height
      && candidate.y + candidateBounds.height > other.y);
    if (overlaps) throw new BadRequestException('This object overlaps another warehouse object. Choose a free area.');
  }

  async createWarehouseObject(userId: number, dto: CreateWarehouseObjectDto) {
    const warehouse = await this.getWarehouse(userId);
    const width = dto.width ?? (dto.type === 'zone' ? 6 : 4);
    const height = dto.type === 'compressor' ? width : dto.height ?? (dto.type === 'zone' ? 4 : 2);
    const object = this.warehouseObjectsRepo.create({
      mapId: warehouse.map.id,
      type: dto.type,
      label: dto.label.trim(),
      x: dto.x ?? 0,
      y: dto.y ?? 0,
      width,
      height,
      rotation: dto.rotation ?? 0,
      color: dto.color || '#123b52',
      notes: dto.notes?.trim() || null,
    });
    if (dto.x === undefined && dto.y === undefined) {
      let placed = false;
      for (let y = 0; y <= warehouse.map.height - 1 && !placed; y += 1) {
        for (let x = 0; x <= warehouse.map.width - 1 && !placed; x += 1) {
          object.x = x;
          object.y = y;
          try {
            this.assertWarehouseObjectFits(object, warehouse.map, warehouse.objects);
            placed = true;
          } catch (error) {
            if (!(error instanceof BadRequestException)) throw error;
          }
        }
      }
      if (!placed) throw new BadRequestException('There is no free space for another object on this warehouse map.');
    }
    this.assertWarehouseObjectFits(object, warehouse.map, warehouse.objects);
    return this.warehouseObjectsRepo.save(object);
  }

  async updateWarehouseObject(id: number, userId: number, dto: UpdateWarehouseObjectDto) {
    const warehouse = await this.getWarehouse(userId);
    const object = await this.warehouseObjectsRepo.findOne({ where: { id, mapId: warehouse.map.id } });
    if (!object) throw new NotFoundException('Warehouse object not found');
    const nextType = dto.type ?? object.type;
    const requestedCompressorSize = dto.width ?? dto.height;
    const compressorSize = nextType === 'compressor' ? requestedCompressorSize ?? Math.max(object.width, object.height) : undefined;
    Object.assign(object, dto, {
      ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      ...(compressorSize !== undefined ? { width: compressorSize, height: compressorSize } : {}),
    });
    const objects = await this.warehouseObjectsRepo.find({ where: { mapId: warehouse.map.id } });
    this.assertWarehouseObjectFits(object, warehouse.map, objects);
    return this.warehouseObjectsRepo.save(object);
  }

  async removeWarehouseObject(id: number, userId: number) {
    const warehouse = await this.getWarehouse(userId);
    const object = await this.warehouseObjectsRepo.findOne({ where: { id, mapId: warehouse.map.id } });
    if (!object) throw new NotFoundException('Warehouse object not found');
    await this.inventoryRepo.update({ centerId: (await this.forOwner(userId)).id, warehouseObjectId: id }, { warehouseObjectId: null });
    await this.warehouseObjectsRepo.remove(object);
    return { deleted: true };
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
    if (dto.warehouseObjectId !== undefined && dto.warehouseObjectId !== null) {
      const center = await this.forOwner(userId);
      const map = await this.warehouseMapsRepo.findOne({ where: { centerId: center.id } });
      const warehouseObject = map ? await this.warehouseObjectsRepo.findOne({ where: { id: dto.warehouseObjectId, mapId: map.id } }) : null;
      if (!warehouseObject) throw new BadRequestException('This inventory location does not belong to your warehouse.');
    }
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
