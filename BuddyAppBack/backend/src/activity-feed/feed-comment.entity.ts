import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class FeedComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  activityId: string;

  @Column()
  userId: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
