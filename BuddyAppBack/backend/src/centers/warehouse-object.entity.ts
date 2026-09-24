import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type WarehouseObjectType = 'rack' | 'shelf' | 'workbench' | 'zone' | 'compressor';

@Entity()
@Index(['mapId', 'x', 'y'])
export class WarehouseObject {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  mapId: number;

  @Column({ default: 'rack' })
  type: WarehouseObjectType;

  @Column({ default: 'Rack' })
  label: string;

  @Column({ type: 'int', default: 0 })
  x: number;

  @Column({ type: 'int', default: 0 })
  y: number;

  @Column({ type: 'int', default: 4 })
  width: number;

  @Column({ type: 'int', default: 2 })
  height: number;

  @Column({ type: 'int', default: 0 })
  rotation: number;

  @Column({ default: '#123b52' })
  color: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
