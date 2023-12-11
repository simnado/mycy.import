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

  @Column()
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

@Entity()
export class MatchedSong extends Song {
  @ApiProperty()
  @Column()
  geniusId: string;

  @Column({ nullable: true })
  musicBrainzId?: string;

  @Column({ nullable: true })
  discogsId?: string;

  @Column()
  spotifyId?: string;

  @Column({ default: true })
  youTubeId?: boolean;

  @Column({ default: true })
  appleMusicId?: boolean;

  @Column({ nullable: true })
  isrc?: string;
}
