import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDiveTripDto } from './dto/create-dive-trip.dto';
import { UpdateDiveTripDto } from './dto/update-dive-trip.dto';
import { DiveTrip } from './dive-trip.entity';
import { PlannedDive } from './planned-dive.entity';
import { TripPlannedDive } from './trip-planned-dive.entity';

@Injectable()
export class DiveTripsService {
  constructor(
    @InjectRepository(DiveTrip) private readonly tripsRepo: Repository<DiveTrip>,
    @InjectRepository(TripPlannedDive) private readonly linksRepo: Repository<TripPlannedDive>,
    @InjectRepository(PlannedDive) private readonly plannedRepo: Repository<PlannedDive>,
  ) {}

  private shape(trip: DiveTrip) {
    const plannedDives = (trip.plannedDiveLinks || [])
      .map((link) => link.plannedDive)
      .filter(Boolean);
    const { plannedDiveLinks, ...rest } = trip;
    return { ...rest, plannedDives };
  }

  async list(userId: number) {
    const trips = await this.tripsRepo.find({
      where: { userId },
      relations: { plannedDiveLinks: { plannedDive: true } },
      order: { startDate: 'ASC', createdAt: 'DESC' },
    });
    return trips.map((trip) => this.shape(trip));
  }

  private async findOwned(id: number, userId: number) {
    const trip = await this.tripsRepo.findOne({
      where: { id, userId },
      relations: { plannedDiveLinks: { plannedDive: true } },
    });
    if (!trip) throw new NotFoundException('Dive trip not found');
    return trip;
  }

  async get(id: number, userId: number) {
    return this.shape(await this.findOwned(id, userId));
  }

  async create(dto: CreateDiveTripDto, userId: number) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('The trip end date must be after its start date');
    const trip = this.tripsRepo.create({
      ...dto,
      userId,
      startDate,
      endDate,
      notes: dto.notes || null,
      status: 'upcoming',
    });
    return this.shape(await this.tripsRepo.save(trip));
  }

  async update(id: number, dto: UpdateDiveTripDto, userId: number) {
    const trip = await this.findOwned(id, userId);
    const startDate = dto.startDate ? new Date(dto.startDate) : trip.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : trip.endDate;
    if (endDate < startDate) throw new BadRequestException('The trip end date must be after its start date');
    Object.assign(trip, dto, { startDate, endDate });
    return this.shape(await this.tripsRepo.save(trip));
  }

  async remove(id: number, userId: number) {
    const trip = await this.findOwned(id, userId);
    await this.tripsRepo.remove(trip);
    return { deleted: true };
  }

  async attach(id: number, plannedDiveId: number, userId: number) {
    const trip = await this.findOwned(id, userId);
    const plan = await this.plannedRepo.findOne({ where: { id: plannedDiveId, userId, status: 'upcoming' } });
    if (!plan) throw new NotFoundException('Upcoming planned dive not found');
    const planDate = new Date(plan.date);
    if (planDate < trip.startDate || planDate > trip.endDate) {
      throw new BadRequestException('The planned dive date must be inside the trip dates');
    }
    const existing = await this.linksRepo.findOne({ where: { tripId: id, plannedDiveId } });
    if (!existing) await this.linksRepo.save(this.linksRepo.create({ tripId: id, plannedDiveId }));
    return this.get(id, userId);
  }

  async detach(id: number, plannedDiveId: number, userId: number) {
    await this.findOwned(id, userId);
    const link = await this.linksRepo.findOne({ where: { tripId: id, plannedDiveId } });
    if (link) await this.linksRepo.remove(link);
    return this.get(id, userId);
  }
}
