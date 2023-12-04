import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiQuery, ApiResponse } from '@nestjs/swagger';
import { GeniusService, SongSearchResult } from './genius/genius.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly geniusSrv: GeniusService) {}

  @Get('')
  hello(): string {
    return 'Hello';
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
  hitById(@Param('id') id: string) {
    return this.geniusSrv.details(id);
  }
}
