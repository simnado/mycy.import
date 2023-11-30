import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiQuery } from '@nestjs/swagger';
import { GeniusService } from './genius/genius.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly geniusSrv: GeniusService) {}

  @ApiQuery({name: 'q', type: String})
  @Get('match/query')
  matchQuery(@Query('q') q) {
    return this.geniusSrv.search(q);
  }

  @Get('match/link')
  matchLink(@Query('url') url): string {
    return 'tba';
  }

  @Get('match/csv')
  matchTable(): string {
    return 'tba'
  }
}
