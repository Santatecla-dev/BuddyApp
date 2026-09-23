import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePlannedDiveDto } from './dto/create-planned-dive.dto';
import { UpdatePlannedDiveDto } from './dto/update-planned-dive.dto';
import { Dive } from './dive.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { PlannedDive } from './planned-dive.entity';

@Injectable()
export class PlannedDivesService {
  constructor(
    @InjectRepository(PlannedDive) private readonly plannedRepo: Repository<PlannedDive>,
    @InjectRepository(Dive) private readonly diveRepo: Repository<Dive>,
    @InjectRepository(DiveBuddy) private readonly diveBuddyRepo: Repository<DiveBuddy>,
  ) {}

  list(userId: number) {
    return this.plannedRepo.find({ where: { userId, status: 'upcoming' }, order: { date: 'ASC', createdAt: 'DESC' } });
  }

  async get(id: number, userId: number) {
    const plan = await this.plannedRepo.findOne({ where: { id, userId } });
    if (!plan) throw new NotFoundException('Planned dive not found');
    return plan;
  }

  async create(dto: CreatePlannedDiveDto, userId: number) {
    const date = new Date(dto.date);
    if (date.getTime() < Date.now() - 86400000) throw new BadRequestException('A planned dive must be today or in the future');
    return this.plannedRepo.save(this.plannedRepo.create({ ...dto, userId, date, notes: dto.notes || null, checklist: dto.checklist || {}, status: 'upcoming' }));
  }

  async update(id: number, dto: UpdatePlannedDiveDto, userId: number) {
    const plan = await this.get(id, userId);
    if (dto.date && new Date(dto.date).getTime() < Date.now() - 86400000) throw new BadRequestException('A planned dive must be today or in the future');
    Object.assign(plan, dto, dto.date ? { date: new Date(dto.date) } : {});
    return this.plannedRepo.save(plan);
  }

  async remove(id: number, userId: number) {
    const plan = await this.get(id, userId);
    await this.plannedRepo.remove(plan);
    return { deleted: true };
  }

  async log(id: number, userId: number) {
    const plan = await this.get(id, userId);
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
    }));
    await this.diveBuddyRepo.save(this.diveBuddyRepo.create({ diveId: dive.id, userId }));
    plan.status = 'logged';
    await this.plannedRepo.save(plan);
    return dive;
  }
}
