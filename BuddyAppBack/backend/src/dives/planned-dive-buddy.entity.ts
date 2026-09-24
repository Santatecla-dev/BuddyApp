import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlannedDive } from './planned-dive.entity';
import { User } from '../users/user.entity';

@Entity()
export class PlannedDiveBuddy {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => PlannedDive, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'plannedDiveId' }) plannedDive: PlannedDive;
  @Column() plannedDiveId: number;
  @ManyToOne(() => User, { eager: true }) @JoinColumn({ name: 'userId' }) user: User;
  @Column() userId: number;
  @CreateDateColumn() joinedAt: Date;
}
