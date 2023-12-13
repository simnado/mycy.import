import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type MatchMedia = {
  provider: string;
  type: 'audio' | 'video';
  url: string;
};

export type LegalPerson = {
  id: string;
  name: string;
  headerImageUrl: string;
  squaredImageUrl: string;
};

export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @ApiProperty()
  title: string;

  @Column()
  @ApiProperty()
  artist: string;

  @Column()
  @ApiProperty()
  releaseDate: string;

  @Column()
  @ApiProperty()
  description: string;

  @Column()
  @ApiProperty()
  language: string;

  @Column({ nullable: true })
  @ApiProperty()
  recordingLocation?: string;

  @Column()
  @ApiProperty()
  imageUrl: string;

  @Column({ type: 'json' })
  relatedArtists?: { roles: string[]; artist: LegalPerson }[];

  @Column({ type: 'json' })
  relatedCompanies?: { roles: string[]; company: LegalPerson }[];

  @Column({ type: 'json' })
  relatedAlbums?: { roles: string[]; album: Album }[];

  @Column({ type: 'json' })
  relatedSongs?: { roles: string[]; song: Song }[];
}

export type Album = {
  id: string;
  title: string;
  artistId: string;
  releaseDate: string;
  coverUrl: string;
};

export enum AnalyzeStatus {
  Pending = 'Pending',
  PreviewAnalyzing = 'PreviewAnalyzing',
  PreviewAnalyzed = 'PreviewAnalyzed',
  PreviewUnavailable = 'PreviewUnavailable',
  CompleteAnalyzable = 'CompleteAnalyzable',
  ConpleteAnalyzing = 'ConpleteAnalyzing',
  CompleteAnalyzed = 'CompleteAnalyzed',
}

@Entity()
export class MatchedSong extends Song {
  @ApiProperty()
  @Column({ unique: true })
  geniusId: string;

  @Column({ unique: true, nullable: true })
  musicBrainzId?: string;

  @Column({ unique: true, nullable: true })
  discogsId?: string;

  @Column({ unique: true })
  spotifyId?: string;

  @Column({ unique: true, nullable: true, type: String })
  youTubeId?: boolean;

  @Column({ unique: true, nullable: true, type: String })
  appleMusicId?: boolean;

  @Column({ unique: true, nullable: true, type: String })
  isrc?: string;

  @Column({ type: 'enum', enum: AnalyzeStatus, default: AnalyzeStatus.Pending })
  analyzeStatus: AnalyzeStatus;

  @Column({ type: 'json', nullable: true })
  analyzeResult: any;
}
