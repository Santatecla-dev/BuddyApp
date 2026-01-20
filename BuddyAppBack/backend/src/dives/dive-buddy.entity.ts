import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Column,
} from 'typeorm';
import { Dive } from './dive.entity';
import { User } from '../users/user.entity';

@Entity()
export class DiveBuddy {
  @PrimaryGeneratedColumn()
  id: number;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ManyToOne(() => Dive, (dive) => dive.buddies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diveId' })
  dive: Dive;

  @Column()
  diveId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ type: 'text', nullable: true })
  personalNotes?: string;
}
