import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveInvite } from './dive-invite.entity';
import { DiveCountry } from './dive-country.enum';

@Entity()
export class Dive {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: Date;

  @Column({
    type: 'enum',
    enum: DiveCountry,
  })
  country: DiveCountry;
  @Column()
  location: string;

  @Column('float')
  maxDepth: number;

  @Column('int')
  duration: number;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => DiveBuddy, (diveBuddy) => diveBuddy.dive)
  buddies: DiveBuddy[];

  @OneToMany(() => DiveInvite, (invite) => invite.dive)
  invites: DiveInvite[];
}
