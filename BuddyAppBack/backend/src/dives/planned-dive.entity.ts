import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DiveCenter } from '../centers/dive-center.entity';
import { DiveSite } from '../centers/dive-site.entity';
import { JoinColumn, ManyToOne } from 'typeorm';

export type PlannedDiveStatus = 'upcoming' | 'logged' | 'cancelled';

@Entity()
export class PlannedDive {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column()
  date: Date;

  @Column()
  country: string;

  @Column()
  location: string;

  @Column('float')
  maxDepth: number;

  @Column('int')
  duration: number;

  @Column({ type: 'int', default: 12 })
  capacity: number;

  @Column({ default: true })
  isPublic: boolean;

  @Column()
  buddy: string;

  @ManyToOne(() => DiveCenter, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'centerId' })
  center: DiveCenter | null;

  @Column({ type: 'int', nullable: true })
  diveSiteId: number | null;

  @ManyToOne(() => DiveSite, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'diveSiteId' })
  diveSite: DiveSite | null;

  @Column()
  condition: string;

  @Column()
  gas: string;

  @Column({ default: true })
  shoreEntry: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'simple-json', nullable: true })
  checklist: Record<string, boolean> | null;

  @Column({ type: 'simple-json', nullable: true })
  inventoryAllocations: Array<{ inventoryId: number; quantity: number; reserved: boolean }> | null;

  @Column({ default: 'upcoming' })
  status: PlannedDiveStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
