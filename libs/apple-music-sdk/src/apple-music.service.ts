import { Injectable } from '@nestjs/common';
import { ProviderService } from 'src/util/interfaces';

@Injectable()
export class AppleMusicService implements ProviderService {
  public toSyncItem(url: string) {
    const groups =
      /https:\/\/music\.apple\.com\/\w\w\/(song\/.+\/(?<songId>\d+))|(album\/.+\/(?<albumId>\d+)\?i\=(?<albumSongId>\d+))/.exec(
        url,
      )?.groups ?? {};

    const trackId = groups.songId ?? groups.albumSongId ?? null;
    return trackId ? { trackId, provider: 'AppleMusic' } : null;
  }
}
