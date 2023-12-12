import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import * as api from 'genius-api';
import { LegalPerson, MatchedSong } from 'src/matching/match/match.entity';

@Injectable()
export class GeniusService {
  protected sdk = new api(process.env.GENIUS_ACCESS_TOKEN);

  async search(q: string) {
    const res = await this.sdk.search(q);
    const { hits } = res;
    const directHits = hits
      .filter((hit) => hit.type === 'song')
      .map((hit) => ({
        geniusId: hit.result.id,
        artist: hit.result.artist_names,
        title: hit.result.title_with_featured,
        thumbnailUrl: hit.result.song_art_image_thumbnail_url,
        releaseDate: hit.result.release_date_for_display,
      }));

    // todo: match with db

    // get detailed information
    const detailResponses = await Promise.all(
      directHits.map((hit) => this.details(hit.geniusId)),
    );

    return detailResponses;
  }

  async details(
    id: string,
    options: { withRelations?: boolean } = {},
  ): Promise<Partial<MatchedSong>> {
    const { song } = await this.sdk.song(id);

    const artists = new Map<string, { roles: string[]; artist: LegalPerson }>();
    const companies = new Map<
      string,
      { roles: string[]; company: LegalPerson }
    >();
    const songs = new Map<string, { roles: string[]; song: any }>();

    if (options.withRelations) {
      if (song.album) {
        artists.set(song.album.artist.id, {
          roles: ['Album Artist'],
          artist: song.album.artist,
        });
      }

      artists.set(song.primary_artist.id, {
        roles: [
          ...(artists.get(song.primary_artist.id)?.roles ?? []),
          'Primary Artist',
        ],
        artist: song.primary_artist,
      });
      for (const featuredArtist of song.featured_artists) {
        artists.set(featuredArtist.id, {
          roles: [
            ...(artists.get(featuredArtist.id)?.roles ?? []),
            'Featured Artist',
          ],
          artist: featuredArtist,
        });
      }
      for (const producer of song.producer_artists) {
        artists.set(producer.id, {
          roles: [
            ...(artists.get(producer.id)?.roles ?? []),
            'Producer Artist',
          ],
          artist: producer,
        });
      }
      for (const writer of song.writer_artists) {
        artists.set(writer.id, {
          roles: [...(artists.get(writer.id)?.roles ?? []), 'Writer Artist'],
          artist: writer,
        });
      }

      const artistPerformanceKeys = [
        'Mixing Engineer',
        'Primary Artists',
        'Bass',
        'Percussion',
        'Guitar',
        'Keyboards',
        'Additional Vocals',
        'Vocals',
        'Engineer',
        'Co-Producer',
        'Background Vocals',
        'Miscellaneous Production',
      ];
      const companyPerformanceKeys = [
        'Mixed At',
        'Performance Rights',
        'Publisher',
        'Licensing',
        'Label',
        'Copyright ©',
        'Phonographic Copyright ℗',
      ];
      const ignoredPerformanceKeys = ['Video Dancer'];
      const unknownLabels = [];

      for (const perf of song.custom_performances) {
        if (artistPerformanceKeys.includes(perf.label)) {
          for (const artist of perf.artists) {
            artists.set(artist.id, {
              roles: [...(artists.get(artist.id)?.roles ?? []), perf.label],
              artist,
            });
          }
        } else if (companyPerformanceKeys.includes(perf.label)) {
          for (const company of perf.artists) {
            companies.set(company.id, {
              roles: [...(companies.get(company.id)?.roles ?? []), perf.label],
              company,
            });
          }
        } else if (
          ignoredPerformanceKeys.includes(perf.label) ||
          /Video/.test(perf.label)
        ) {
          continue;
        } else {
          unknownLabels.push(perf.label);
        }
      }

      if (unknownLabels.length) {
        console.warn(`unknown label ${unknownLabels.join(', ')}`);
      }

      for (const relation of song.song_relationships.filter(
        (rel) => !['translation_of', 'translations'].includes(rel.type),
      )) {
        for (const song of relation.songs) {
          songs.set(song.id, {
            roles: [...(songs.get(song.id)?.roles ?? []), relation.type],
            song: this.mapSong(song),
          });
        }
      }
    }

    for (const media of song.media.filter(
      (m) => !['spotify', 'youtube'].includes(m.provider),
    )) {
      console.warn('unknown provider on genius called ' + media.provider);
    }

    const res = {
      geniusId: song.id,
      appleMusicId: song.apple_music_id ?? undefined,
      // todo: use services to get id from url
      spotifyId: song.media
        .find((m) => m.provider === 'spotify')
        ?.url.split('/track/')
        .pop(),
      youTubeId: song.media
        .find((m) => m.provider === 'youtube')
        ?.url.split('v=')
        .pop(),
      ...this.mapSong(song),
    };

    if (options.withRelations) {
      Object.assign(res, {
        relatedAlbums: [
          {
            roles: ['album'],
            album: song.album
              ? {
                  id: song.album.id,
                  title: song.album.name,
                  artistId: song.album.artist.id,
                  releaseDate: new Date(
                    `${song.album.release_date_for_display} 12:00`,
                  )
                    .toISOString()
                    .slice(0, 10),
                  coverUrl: song.album.cover_art_url,
                }
              : null,
          },
        ],
        relatedArtists: Array.from(artists.values()).map(
          ({ roles, artist }) => ({
            roles,
            artist: this.mapArtist(artist),
          }),
        ),
        relatedCompanies: Array.from(companies.values()).map(
          ({ roles, company }) => ({ roles, company: this.mapArtist(company) }),
        ),
        relatedSongs: Array.from(songs.values()),
      });
    }

    return res;
  }

  private flatDescription(el: { children?: any[]; tag: string }) {
    const res = [];
    for (const child of el.children ?? []) {
      if (typeof child === 'object') {
        res.push(this.flatDescription(child));
      } else {
        res.push(child);
      }

      if (child.tag === 'p') {
        res.push('\n');
      }
    }
    return res.join('').trim();
  }

  protected mapSong(song: any) {
    return {
      geniusId: String(song.id),
      title: song.title,
      artist: song.artist_names,
      releaseDate: song.release_date,
      // todo use api text_format=plain
      description: this.flatDescription(
        song.description?.dom ?? { children: [] },
      ),
      language: song.language,
      recordingLocation: song.recording_location,
      imageUrl: song.song_art_image_url,
    };
  }

  protected mapArtist(artist: any) {
    return {
      id: artist.id,
      name: artist.name,
      headerImageUrl: artist.header_image_url,
      squaredImageUrl: artist.image_url,
    };
  }
}
