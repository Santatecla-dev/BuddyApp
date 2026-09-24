import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export type NotificationType = 'dive' | 'comment' | 'reaction' | 'invite' | 'invite_accepted' | 'invite_rejected' | 'achievement' | 'sighting';

@Entity()
@Index(['recipientId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType;

  @Column()
  recipientId: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @Column({ type: 'integer', nullable: true })
  actorId: number | null;

  @Column({ length: 140 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  dedupeKey: string | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
