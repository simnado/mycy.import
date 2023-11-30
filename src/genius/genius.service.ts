import { Injectable } from '@nestjs/common';
import * as api from 'genius-api';

export type LegalPerson = {
    id: string;
    name:  string;
    headerImageUrl: string;
    squaredImageUrl: string;
}

export type Song = {
    id: string;
    title: string;
    artist: string;
    releaseDate: string;
    description: string;
    language: string;
    recordingLocation: string;
    imageUrl: string;
}

export type Album = {
    id: string;
    title: string;
    artistId: string;
    releaseDate: string;
    coverUrl: string;
}

@Injectable()
export class GeniusService {

    protected sdk = new api(process.env.GENIUS_ACCESS_TOKEN);

    async search(q: string) {
        const res = await this.sdk.search(q);
        const {hits} = res;
        return hits.filter(hit => hit.type === 'song').map(hit => ({
            id: hit.result.id,
            title: hit.result.full_title,
            thumbnail: hit.result.header_image_thumbnail_url,
            releaseDate: hit.result.release_date_for_display,
        }));
    }

    async details(id: string) {
        const { song } = await this.sdk.song(id);

        const artists = new Map<string, {roles: string[], artist: LegalPerson}>();
        const companies = new Map<string, {roles: string[], company: LegalPerson}>();
        const songs = new Map<string, {roles: string[], song: any}>();

        artists.set(song.album.artist.id, {roles: ['Album Artist'], artist: song.album.artist});
        artists.set(song.primary_artist.id, {roles: [...(artists.get(song.primary_artist.id)?.roles ?? []), 'Primary Artist'], artist: song.primary_artist});
        for (const featuredArtist of song.featured_artists) {
            artists.set(featuredArtist.id, {roles: [...(artists.get(featuredArtist.id)?.roles ?? []), 'Featured Artist'], artist: featuredArtist});
        }
        for (const producer of song.producer_artists) {
            artists.set(producer.id, {roles: [...(artists.get(producer.id)?.roles ?? []), 'Producer Artist'], artist: producer});
        }
        for (const writer of song.writer_artists) {
            artists.set(writer.id, {roles: [...(artists.get(writer.id)?.roles ?? []), 'Writer Artist'], artist: writer});
        }

        const artistPerformanceKeys = ['Mixing Engineer', 'Primary Artists', 'Bass', 'Percussion', 'Guitar', 'Keyboards', 'Additional Vocals', ];
        const companyPerformanceKeys = ['Mixed At', 'Performance Rights', 'Publisher', 'Licensing', 'Label', 'Copyright ©', 'Phonographic Copyright ℗'];

        for (const perf of song.custom_performances) {
            if (artistPerformanceKeys.includes(perf.label)) {
                for (const artist of perf.artists) {
                    artists.set(artist.id, {roles: [...(artists.get(artist.id)?.roles ?? []), perf.label], artist})
                }
            } else if(companyPerformanceKeys.includes(perf.label)) {
                for (const company of perf.artists) {
                    companies.set(company.id, {roles: [...(companies.get(company.id)?.roles ?? []), perf.label], company})
                }
            } else {
                throw new Error(`unknown label ${perf.label}`)
            }
        }

        for (const relation of song.song_relationships.filter(rel => !['translation_of', 'translations'].includes(rel.type))) {
            for (const song of relation.songs) {
                songs.set(song.id, {roles: [...(songs.get(song.id)?.roles ?? []), relation.type], song: this.mapSong(song)});
            }
        }

        return {
            id: song.id,
            media: [...song.media, { provider: 'apple music', type: 'audio', url: `https://music.apple.com/de/song/_/${song.apple_music_id }`}],
            song: this.mapSong(song),
            album: { // todo: do detail request (non-public api)
                id: song.album.id,
                title: song.album.name,
                artistId: song.album.artist.id,
                releaseDate: song.album.release_date_for_display,
                coverUrl: song.album.cover_art_url,
            },
            artists: Array.from(artists.values()).map(({roles, artist}) => ({roles, company: this.mapArtist(artist)})),
            companies: Array.from(companies.values()).map(({roles, company}) => ({roles, company: this.mapArtist(company)})),
            relatedSongs: Array.from(songs.values()),
        };
    }

    protected mapSong(song: any) {
        return {
            id: song.id,
            title: song.title,
            artist: song.artist_names,
            releaseDate: song.release_date,
            description: song.description?.dom.children.map(el => {  // todo: support deeper nesting
                for (const child of el.children ?? []) {
                    if (typeof child === 'object') {
                        child.children = child.children.map(el => el.children);
                    }
                }                    
                return (el.tag === 'p' ? `${el.children}\n` : el.children)?.trim();
            }).join(),
            language: song.language,
            recordingLocation: song.recording_location,
            imageUrl: song.song_art_image_url,
        }
    }

    protected mapArtist(artist: any) {
        return {
            id: artist.id,
            name: artist.name,
            headerImageUrl: artist.header_image_url,
            squaredImageUrl: artist.image_url,
          }
    }
}
