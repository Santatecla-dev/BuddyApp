import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type DiveSiteRoute = {
  name: string;
  notes?: string;
  points: Array<{ latitude: number; longitude: number; label?: string }>;
};

@Entity()
@Index(['centerId', 'mapKey'])
export class DiveSite {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  centerId: number;

  @Column({ default: 'panglao-bohol' })
  mapKey: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column('float')
  latitude: number;

  @Column('float')
  longitude: number;

  @Column({ type: 'float', nullable: true })
  minDepth: number | null;

  @Column({ type: 'float', nullable: true })
  maxDepth: number | null;

  @Column({ type: 'varchar', nullable: true })
  difficulty: string | null;

  @Column({ type: 'text', nullable: true })
  currentInfo: string | null;

  @Column({ type: 'simple-json', nullable: true })
  highlights: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  typicalSightings: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  routes: DiveSiteRoute[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
