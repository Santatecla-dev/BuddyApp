import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveInvite } from './dive-invite.entity';
import { DIVE_COUNTRY_VALUES } from './country.values';
import { DiveSighting } from './dive-sighting.entity';
import { DiveCenter } from '../centers/dive-center.entity';

@Entity()
export class Dive {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: Date;

  @Column({
    type: 'enum',
    enum: DIVE_COUNTRY_VALUES,
  })
  country: string;
  @Column()
  location: string;

  @Column('float')
  maxDepth: number;

  @Column('int')
  duration: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @ManyToOne(() => DiveCenter, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'centerId' })
  center: DiveCenter | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => DiveBuddy, (diveBuddy) => diveBuddy.dive)
  buddies: DiveBuddy[];

  @OneToMany(() => DiveInvite, (invite) => invite.dive)
  invites: DiveInvite[];

  @OneToMany(() => DiveSighting, (sighting) => sighting.dive)
  sightings: DiveSighting[];
}
