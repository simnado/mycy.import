import { Body, Controller, Get, Param, Query, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiParam, ApiQuery, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { GeniusService, SongSearchResult } from './genius/genius.service';
import { DiscogsService } from './discogs/discogs.service';
import { Match } from './matching/match/match.entity';
import { MatchService } from './matching/match/match.service';
import { CyaniteSdkService, CyaniteWebhookPayload } from '@narendev/cyanite-sdk';
import { getOnConflictReturningFields } from '@mikro-orm/core';


export class TriggerPayload {
  @ApiProperty()
  youTubeUrl: string
}



@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService, 
    private readonly geniusSrv: GeniusService, 
    private discogsSrv: DiscogsService, 
    private matchSrv: MatchService,
    private cyaniteSrv: CyaniteSdkService,
    ) {}

  @Get('')
  hello() {
    return this.discogsSrv.search('Industry Baby');
  }

  @ApiQuery({name: 'q', type: String})
  @ApiResponse({type: SongSearchResult, isArray: true})
  @Get('match/query')
  matchByQuery(@Query('q') q) {
    return this.geniusSrv.search(q);
  }

  @Get('match/link')
  matchByLink(@Query('url') url): string {
    // todo: support genius, apple music, youtube and spotify links
    return 'tba';
  }

  @Get('match/csv')
  matchByTable(): string {
    return 'tba'
  }


  @Get('hit/:id')
  @ApiResponse({type: Match})
  async hitById(@Param('id') geniusId: string) {
    let match = await this.matchSrv.findOne(geniusId)
    if(!match) {
      const newMatch = await this.geniusSrv.details(geniusId);
      match = await this.matchSrv.createOne(newMatch);
      console.log('created', match.id)
    }
    return match;
  }

  @Get('cy/library')
  getCyaniteLibrary(){
    return this.cyaniteSrv.getLibrary({});
  }

  @Get('cy/song/:id')
  @ApiParam({type: String, name: 'id'})
  getSong(@Param('id') id) {
    return this.cyaniteSrv.getSongAnalysis(id)
  }

  @Post('cy/trigger')
  async triggerProcessing(@Body() data: TriggerPayload) {
    const res = await this.cyaniteSrv.triggerSongAnalysisFromYouTube(data.youTubeUrl)
    if (res.youTubeTrackEnqueue.__typename === 'YouTubeTrackEnqueueError') {
      console.warn(res.youTubeTrackEnqueue)
    }
    return res
  }

  @Post('cy/webhook')
  webhook(@Body() data: CyaniteWebhookPayload) {
    console.log(data)
  }
}