import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity()
@Unique(['userId', 'achievementId'])
export class AchievementState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 100 })
  achievementId: string;

  @Column({ default: false })
  unlocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  unlockedAt?: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
