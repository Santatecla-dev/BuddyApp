import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type UserAccountType = 'diver' | 'center';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', default: 'diver' })
  accountType: UserAccountType;

  // 🆕 Agencia (opcional)
  @Column({ type: 'text', nullable: true })
  agency: string | null;

  // 🆕 Titulaciones (opcional, múltiples)
  @Column('simple-array', { nullable: true })
  certifications: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
