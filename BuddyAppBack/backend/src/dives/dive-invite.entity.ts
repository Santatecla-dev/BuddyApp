import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Dive } from './dive.entity';
import { User } from '../users/user.entity';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity()
export class DiveInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Dive, (dive) => dive.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diveId' })
  dive: Dive;

  @Column()
  diveId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'invitedUserId' })
  invitedUser: User;

  @Column()
  invitedUserId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'invitedByUserId' })
  invitedByUser: User;

  @Column()
  invitedByUserId: number;

  @Column({ type: 'enum', enum: InviteStatus, default: InviteStatus.PENDING })
  status: InviteStatus;

  @CreateDateColumn()
  createdAt: Date;
}
