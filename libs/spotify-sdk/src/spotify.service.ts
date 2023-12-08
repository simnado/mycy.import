import { Injectable } from '@nestjs/common';
import { ProviderService, SyncItem } from 'src/util/interfaces';

@Injectable()
export class SpotifyService implements ProviderService {
  toSyncItem(url: string): SyncItem {
    const groups =
      /https:\/\/open\.spotify\.com\/(.+\/)?track\/(?<songId>.+)(\/.*)?/.exec(
        url,
      )?.groups ?? {};

    const trackId = groups.songId ?? groups.albumSongId ?? null;
    return trackId ? { trackId, provider: 'Spotify' } : null;
  }
}
