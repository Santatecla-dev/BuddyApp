import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlannedDive } from './planned-dive.entity';
import { User } from '../users/user.entity';

export enum PlannedInviteStatus { PENDING = 'PENDING', ACCEPTED = 'ACCEPTED', REJECTED = 'REJECTED' }

@Entity()
export class PlannedDiveInvite {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => PlannedDive, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'plannedDiveId' }) plannedDive: PlannedDive;
  @Column() plannedDiveId: number;
  @ManyToOne(() => User, { eager: true }) @JoinColumn({ name: 'invitedUserId' }) invitedUser: User;
  @Column() invitedUserId: number;
  @ManyToOne(() => User, { eager: true }) @JoinColumn({ name: 'invitedByUserId' }) invitedByUser: User;
  @Column() invitedByUserId: number;
  @Column({ type: 'enum', enum: PlannedInviteStatus, default: PlannedInviteStatus.PENDING }) status: PlannedInviteStatus;
  @CreateDateColumn() createdAt: Date;
}
