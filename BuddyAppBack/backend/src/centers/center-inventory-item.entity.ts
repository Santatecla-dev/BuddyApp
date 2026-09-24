import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@Index(['centerId', 'category'])
export class CenterInventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  centerId: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ default: 1 })
  quantity: number;

  @Column({ default: 'available' })
  status: 'available' | 'maintenance' | 'retired';

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  nextServiceDate: Date | null;

  @Column({ type: 'int', nullable: true })
  warehouseObjectId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
