import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@Index(['userId', 'equipmentId'])
export class EquipmentPacking {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Index()
  @Column()
  equipmentId: number;

  @Index()
  @Column({ type: 'integer', nullable: true })
  tripId: number | null;

  @Index()
  @Column({ type: 'integer', nullable: true })
  plannedDiveId: number | null;

  @Column({ default: false })
  packed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
