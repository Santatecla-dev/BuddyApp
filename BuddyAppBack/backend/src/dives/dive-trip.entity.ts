import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TripPlannedDive } from './trip-planned-dive.entity';

export type DiveTripStatus = 'upcoming' | 'completed' | 'cancelled';

@Entity()
@Index(['userId', 'startDate'])
export class DiveTrip {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column()
  name: string;

  @Column()
  destination: string;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: 'upcoming' })
  status: DiveTripStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TripPlannedDive, (link) => link.trip)
  plannedDiveLinks: TripPlannedDive[];
}
