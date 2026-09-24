import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
@Index(['centerId'], { unique: true })
export class WarehouseMap {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  centerId: number;

  @Column({ default: 'Main warehouse' })
  name: string;

  @Column({ type: 'int', default: 24 })
  width: number;

  @Column({ type: 'int', default: 16 })
  height: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
