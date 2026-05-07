import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  rtsp_url: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: 'OFFLINE' })
  status: string;
}
