import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  PreconditionFailedException,
} from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { GeniusService } from './genius/genius.service';
import { DiscogsService } from './discogs/discogs.service';
import { MatchedSong } from './matching/match/match.entity';
import { MatchService } from './matching/match/match.service';
import { AppleMusicService } from '@narendev/apple-music-sdk';
import { SpotifyService } from '@narendev/spotify-sdk';
import { AppService } from './app.service';

export enum SyncInputProvider {
  Itunes = 'Itunes',
  AppleMusic = 'AppleMusic',
  Spotify = 'Spotify',
  YouTube = 'YouTube',
}

export class SyncRequestGroup {
  @ApiProperty()
  geniusId?: string;

  @ApiProperty()
  priority: number;
}

export class SyncResponseItem {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  requestIdx: number;
}

export class SyncResponseGroup {
  @ApiProperty()
  status:
    | 'pending'
    | 'matched'
    | 'unmatched'
    | 'scheduled'
    | 'conflicted'
    | 'analysed'
    | 'analysable';

  @ApiProperty({ type: SyncResponseItem, isArray: true })
  items: SyncResponseItem[];
}

export class SyncRequest {
  @ApiProperty({ type: SyncRequestGroup, isArray: true })
  items: SyncRequestGroup[];
}

export class SyncResponse {
  @ApiProperty()
  syncId: string;

  @ApiProperty({ type: SyncResponseGroup, isArray: true })
  items: SyncResponseGroup[];
}

@Controller()
export class AppController {
  constructor(
    private readonly appleMusicSrv: AppleMusicService,
    private readonly spotifySrv: SpotifyService,
    private readonly geniusSrv: GeniusService,
    private discogsSrv: DiscogsService,
    private matchSrv: MatchService,
    private appSrv: AppService,
  ) {}

  @Get('')
  hello() {
    return this.discogsSrv.search('Industry Baby');
  }

  @ApiQuery({ name: 'q', type: String })
  @ApiResponse({ type: MatchedSong, isArray: true })
  @Get('match/query')
  async matchByQuery(@Query('q') q) {
    const geniusRes = await this.geniusSrv.search(q);

    const geniusId2dbId = new Map<string, number>();

    const dbMatches = await this.matchSrv.findMany({
      geniusIds: geniusRes.map((i) => i.geniusId),
    });
    for (const item of dbMatches) {
      geniusId2dbId.set(item.geniusId, item.id);
    }

    for (const res of geniusRes) {
      Object.assign(res, {
        id: geniusId2dbId.get(String(res.geniusId)) ?? undefined,
      });
    }

    return geniusRes;
  }

  @ApiQuery({ name: 'url', type: String })
  @Get('match/link')
  matchByLink(@Query('url') url) {
    const syncItem =
      this.spotifySrv.toSyncItem(url) ?? this.appleMusicSrv.toSyncItem(url);
    return syncItem;
  }

  @Get('hits')
  @ApiResponse({ type: MatchedSong, isArray: true })
  async hits() {
    return await this.matchSrv.findMany();
  }

  @Get('hit/:id')
  @ApiResponse({ type: MatchedSong })
  async hitById(@Param('id') id: string) {
    let match = await this.matchSrv.findOne(Number(id));
    return match;
  }

  @Post('sync')
  @ApiResponse({ type: SyncResponse })
  sync(@Body() data: SyncRequest) {
    console.log(data);
    const { items } = data;
    if (items.length > 10) {
      throw new PreconditionFailedException(
        'maximum number of items per sync request is 10',
      );
    }

    return items.map((i) => this.appSrv.syncItems(items));
  }
}
