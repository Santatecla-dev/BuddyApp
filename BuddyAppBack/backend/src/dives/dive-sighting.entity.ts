import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Dive } from './dive.entity';

@Entity()
@Unique(['diveId', 'speciesKey'])
export class DiveSighting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  diveId: number;

  @ManyToOne(() => Dive, (dive) => dive.sightings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diveId' })
  dive: Dive;

  @Column({ length: 80 })
  speciesKey: string;

  @Column()
  createdByUserId: number;

  @CreateDateColumn()
  createdAt: Date;
}
