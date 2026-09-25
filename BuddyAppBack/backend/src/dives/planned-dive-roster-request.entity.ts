import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlannedDive } from './planned-dive.entity';
import { User } from '../users/user.entity';

export enum RosterRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

@Entity()
@Index(['plannedDiveId', 'userId'], { unique: true })
export class PlannedDiveRosterRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PlannedDive, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plannedDiveId' })
  plannedDive: PlannedDive;

  @Column()
  plannedDiveId: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'enum', enum: RosterRequestStatus, default: RosterRequestStatus.PENDING })
  status: RosterRequestStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;
}
