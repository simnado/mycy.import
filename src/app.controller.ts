import { Body, Controller, Get, Param, Query, Post } from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { GeniusService } from './genius/genius.service';
import { DiscogsService } from './discogs/discogs.service';
import { MatchedSong } from './matching/match/match.entity';
import { MatchService } from './matching/match/match.service';
import { AppleMusicService } from '@narendev/apple-music-sdk';
import { SpotifyService } from '@narendev/spotify-sdk';

export enum SyncInputProvider {
  Itunes = 'Itunes',
  AppleMusic = 'AppleMusic',
  Spotify = 'Spotify',
  YouTube = 'YouTube',
}

export class SyncRequestItem {
  @ApiProperty()
  q: string;
}

export class SyncRequestGroup {
  @ApiProperty({ enum: SyncInputProvider, enumName: 'SyncInputProvider' })
  provider?: SyncInputProvider;

  @ApiProperty({ type: SyncRequestItem, isArray: true })
  items: SyncRequestItem[];
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
  groups: SyncRequestGroup[];
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
  ) {}

  @Get('')
  hello() {
    return this.discogsSrv.search('Industry Baby');
  }

  @ApiQuery({ name: 'q', type: String })
  @ApiResponse({ type: MatchedSong, isArray: true })
  @Get('match/query')
  matchByQuery(@Query('q') q) {
    return this.geniusSrv.search(q);
  }

  @ApiQuery({ name: 'url', type: String })
  @Get('match/link')
  matchByLink(@Query('url') url) {
    const syncItem =
      this.spotifySrv.toSyncItem(url) ?? this.appleMusicSrv.toSyncItem(url);
    return syncItem;
  }

  @Get('hit/:id')
  @ApiResponse({ type: MatchedSong })
  async hitById(@Param('id') geniusId: string) {
    let match = await this.matchSrv.findOne(geniusId);
    if (!match) {
      const newMatch = await this.geniusSrv.details(geniusId, {
        withRelations: true,
      });
      match = await this.matchSrv.createOne(newMatch);
      console.log('created', match.id);
    }
    return match;
  }

  @Post('sync')
  @ApiResponse({ type: SyncResponse })
  sync(@Body() data: SyncRequest) {}
}
