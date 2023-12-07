import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  spotifyId: string;

  @Column()
  youTubeId: string;

  @Column({ nullable: true })
  result: any;
}
