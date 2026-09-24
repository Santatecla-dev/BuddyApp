import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dive } from '../dives/dive.entity';
import { User } from '../users/user.entity';
import { DiveCenter } from './dive-center.entity';

export enum CenterLinkRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity()
export class CenterLinkRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Dive, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diveId' })
  dive: Dive;

  @Column()
  diveId: number;

  @ManyToOne(() => DiveCenter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'centerId' })
  center: DiveCenter;

  @Column()
  centerId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requestedByUserId' })
  requestedBy: User;

  @Column()
  requestedByUserId: number;

  @Column({ type: 'enum', enum: CenterLinkRequestStatus, default: CenterLinkRequestStatus.PENDING })
  status: CenterLinkRequestStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;
}
