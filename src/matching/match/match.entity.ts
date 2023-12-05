import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type MatchMedia = {
    provider: string;
    type: 'audio' | 'video';
    url: string;
}

export type LegalPerson = {
    id: string;
    name:  string;
    headerImageUrl: string;
    squaredImageUrl: string;
}

export class Song {
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    artist: string;

    @ApiProperty()
    releaseDate: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    language: string;

    @ApiProperty()
    recordingLocation: string;

    @ApiProperty()
    imageUrl: string;
}

export type Album = {
    id: string;
    title: string;
    artistId: string;
    releaseDate: string;
    coverUrl: string;
}

@Entity()
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column()
  geniusId: string;

  @Column({nullable: true})
  musicBrainzId?: string;

  @Column({nullable: true})
  discogsId?: string;

  @Column()
  spotifyId?: string;

  @Column({ default: true })
  youTubeId?: boolean;

  @Column({ default: true })
  appleMusicId?: boolean;

  @Column({type: 'json'})
  media: MatchMedia[];

  @ApiProperty({type: Song})
  @Column({type: 'json'})
  song: Song;

  @Column({type: 'json'})
  relatedArtists: {roles: string[], artist: LegalPerson}[]

  @Column({type: 'json'})
  relatedCompanies: {roles: string[], company: LegalPerson}[]

  @Column({type: 'json'})
  relatedAlbums: {roles: string[], album: Album}[]

  @Column({type: 'json'})
  relatedSongs: {roles: string[], song: Song}[]
}