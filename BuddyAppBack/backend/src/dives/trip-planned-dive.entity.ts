import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DiveTrip } from './dive-trip.entity';
import { PlannedDive } from './planned-dive.entity';

@Entity()
@Index(['tripId', 'plannedDiveId'], { unique: true })
export class TripPlannedDive {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tripId: number;

  @Column()
  plannedDiveId: number;

  @ManyToOne(() => DiveTrip, (trip) => trip.plannedDiveLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripId' })
  trip: DiveTrip;

  @ManyToOne(() => PlannedDive, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plannedDiveId' })
  plannedDive: PlannedDive;
}
