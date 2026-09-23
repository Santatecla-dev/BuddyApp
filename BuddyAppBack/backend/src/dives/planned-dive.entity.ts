import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @Column()
  buddy: string;

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

  @Column({ default: 'upcoming' })
  status: PlannedDiveStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
