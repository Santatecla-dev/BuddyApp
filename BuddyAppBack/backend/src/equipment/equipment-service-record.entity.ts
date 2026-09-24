import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(['userId', 'equipmentId', 'serviceDate'])
export class EquipmentServiceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Index()
  @Column()
  equipmentId: number;

  @Column({ type: 'date' })
  serviceDate: Date;

  @Column({ type: 'date', nullable: true })
  nextDueDate: Date | null;

  @Column()
  serviceType: string;

  @Column({ type: 'varchar', nullable: true })
  provider: string | null;

  @Column({ type: 'float', nullable: true })
  cost: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
