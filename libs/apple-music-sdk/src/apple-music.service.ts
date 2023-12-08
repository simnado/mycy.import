import { Injectable } from '@nestjs/common';

@Injectable()
export class AppleMusicService {
  public toSyncItem(url: string) {
    const groups =
      /https:\/\/music\.apple\.com\/\w\w\/(song\/.+\/(?<songId>\d+))|(album\/.+\/(?<albumId>\d+)\?i\=(?<albumSongId>\d+))/.exec(
        url,
      )?.groups ?? {};

    const id = groups.songId ?? groups.albumSongId ?? null;
    return id ? { id, provider: 'AppleMusic' } : null;
  }
}
