import { Body, Controller, Get, Param, Query, Post } from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { GeniusService, SongSearchResult } from './genius/genius.service';
import { DiscogsService } from './discogs/discogs.service';
import { Match } from './matching/match/match.entity';
import { MatchService } from './matching/match/match.service';
import { AppleMusicService } from '@narendev/apple-music-sdk';

export enum SyncInputProvider {
  Itunes = 'Itunes',
  AppleMusic = 'AppleMusic',
  Spotify = 'Spotify',
  YouTube = 'YouTube',
}

export class TriggerPayload {
  @ApiProperty()
  youTubeUrl: string;
}

export class SyncRequestItem {
  @ApiProperty()
  q: string;

  @ApiProperty({ enum: SyncInputProvider, enumName: 'SyncInputProvider' })
  provider: SyncInputProvider;
}

export class SyncResponseItem {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  status:
    | 'pending'
    | 'matched'
    | 'unmatched'
    | 'scheduled'
    | 'conflicted'
    | 'analysed'
    | 'analysable';
}

export class SyncRequest {
  @ApiProperty({ type: SyncRequestItem, isArray: true })
  items: SyncRequestItem[];
}

export class SyncResponse {
  @ApiProperty({ type: SyncResponseItem, isArray: true })
  items: SyncResponseItem[];
}

@Controller()
export class AppController {
  constructor(
    private readonly appleMusicSrv: AppleMusicService,
    private readonly geniusSrv: GeniusService,
    private discogsSrv: DiscogsService,
    private matchSrv: MatchService,
  ) {}

  @Get('')
  hello() {
    return this.discogsSrv.search('Industry Baby');
  }

  @ApiQuery({ name: 'q', type: String })
  @ApiResponse({ type: SongSearchResult, isArray: true })
  @Get('match/query')
  matchByQuery(@Query('q') q) {
    return this.geniusSrv.search(q);
  }

  @ApiQuery({ name: 'url', type: String })
  @Get('match/link')
  matchByLink(@Query('url') url) {
    const syncItem = this.appleMusicSrv.toSyncItem(url);
    return syncItem;
  }

  @Get('match/csv')
  matchByTable(): string {
    return 'tba';
  }

  @Get('hit/:id')
  @ApiResponse({ type: Match })
  async hitById(@Param('id') geniusId: string) {
    let match = await this.matchSrv.findOne(geniusId);
    if (!match) {
      const newMatch = await this.geniusSrv.details(geniusId);
      match = await this.matchSrv.createOne(newMatch);
      console.log('created', match.id);
    }
    return match;
  }

  @Post('sync')
  @ApiResponse({ type: SyncResponse })
  sync(@Body() data: SyncRequest) {}
}
