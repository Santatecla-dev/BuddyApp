import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['activityId', 'userId'])
export class FeedReaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  activityId: string;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}
