import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Equipment } from './equipment.entity';
import { EquipmentPacking } from './equipment-packing.entity';
import { CreatePackingDto } from './dto/create-packing.dto';
import { UpdatePackingDto } from './dto/update-packing.dto';
import { EquipmentServiceRecord } from './equipment-service-record.entity';
import { CreateServiceRecordDto } from './dto/create-service-record.dto';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment) private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(EquipmentServiceRecord) private readonly serviceRecordsRepo: Repository<EquipmentServiceRecord>,
    @InjectRepository(EquipmentPacking) private readonly packingRepo: Repository<EquipmentPacking>,
  ) {}

  list(userId: number) {
    return this.equipmentRepo.find({ where: { userId }, order: { category: 'ASC', name: 'ASC' } });
  }

  private async findOwned(id: number, userId: number) {
    const equipment = await this.equipmentRepo.findOne({ where: { id, userId } });
    if (!equipment) throw new NotFoundException('Equipment item not found');
    return equipment;
  }

  async get(id: number, userId: number) {
    return this.findOwned(id, userId);
  }

  async create(dto: CreateEquipmentDto, userId: number) {
    return this.equipmentRepo.save(this.equipmentRepo.create({
      ...dto,
      userId,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null,
      brand: dto.brand || null,
      model: dto.model || null,
      serialNumber: dto.serialNumber || null,
      notes: dto.notes || null,
      condition: dto.condition || 'good',
      packed: dto.packed ?? false,
    }));
  }

  async update(id: number, dto: UpdateEquipmentDto, userId: number) {
    const equipment = await this.findOwned(id, userId);
    Object.assign(equipment, dto, {
      ...(dto.purchaseDate !== undefined ? { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null } : {}),
      ...(dto.nextServiceDate !== undefined ? { nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null } : {}),
    });
    return this.equipmentRepo.save(equipment);
  }

  async remove(id: number, userId: number) {
    const equipment = await this.findOwned(id, userId);
    await this.equipmentRepo.remove(equipment);
    return { deleted: true };
  }

  async listServiceRecords(equipmentId: number, userId: number) {
    await this.findOwned(equipmentId, userId);
    return this.serviceRecordsRepo.find({ where: { equipmentId, userId }, order: { serviceDate: 'DESC', createdAt: 'DESC' } });
  }

  async createServiceRecord(equipmentId: number, dto: CreateServiceRecordDto, userId: number) {
    const equipment = await this.findOwned(equipmentId, userId);
    const record = await this.serviceRecordsRepo.save(this.serviceRecordsRepo.create({
      equipmentId,
      userId,
      serviceDate: new Date(dto.serviceDate),
      nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      serviceType: dto.serviceType,
      provider: dto.provider || null,
      cost: dto.cost ?? null,
      notes: dto.notes || null,
    }));
    if (dto.nextDueDate) {
      equipment.nextServiceDate = new Date(dto.nextDueDate);
      await this.equipmentRepo.save(equipment);
    }
    return record;
  }

  async removeServiceRecord(recordId: number, userId: number) {
    const record = await this.serviceRecordsRepo.findOne({ where: { id: recordId, userId } });
    if (!record) throw new NotFoundException('Service record not found');
    await this.serviceRecordsRepo.remove(record);
    return { deleted: true };
  }

  async listPacking(userId: number, equipmentId?: number, tripId?: number, plannedDiveId?: number) {
    const where: any = { userId };
    if (equipmentId) where.equipmentId = equipmentId;
    if (tripId) where.tripId = tripId;
    if (plannedDiveId) where.plannedDiveId = plannedDiveId;
    return this.packingRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  async createPacking(dto: CreatePackingDto, userId: number) {
    if (!dto.tripId && !dto.plannedDiveId) throw new BadRequestException('Choose a trip or planned dive');
    await this.findOwned(dto.equipmentId, userId);
    const where = { userId, equipmentId: dto.equipmentId, tripId: dto.tripId ?? null, plannedDiveId: dto.plannedDiveId ?? null };
    const existing = await this.packingRepo.findOne({ where: where as any });
    if (existing) return existing;
    return this.packingRepo.save(this.packingRepo.create({ ...where, packed: false }));
  }

  async updatePacking(id: number, dto: UpdatePackingDto, userId: number) {
    const item = await this.packingRepo.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException('Packing item not found');
    item.packed = dto.packed;
    return this.packingRepo.save(item);
  }

  async removePacking(id: number, userId: number) {
    const item = await this.packingRepo.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException('Packing item not found');
    await this.packingRepo.remove(item);
    return { deleted: true };
  }
}
