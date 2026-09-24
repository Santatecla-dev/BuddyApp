import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EquipmentCondition = 'good' | 'service_due' | 'retired';

@Entity()
@Index(['userId', 'category'])
export class Equipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'varchar', nullable: true })
  serialNumber: string | null;

  @Column({ type: 'date', nullable: true })
  purchaseDate: Date | null;

  @Column({ type: 'date', nullable: true })
  nextServiceDate: Date | null;

  @Column({ default: 'good' })
  condition: EquipmentCondition;

  @Column({ default: false })
  packed: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
