import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { TriggerPayload } from 'src/app.controller';
import { CyaniteWebhookPayload } from './models';
import { CyaniteSdkService } from './cyanite-sdk.service';

@ApiTags('Cyanite')
@Controller('cy')
export class CyaniteController {

    constructor(@Inject(CyaniteSdkService) private readonly cyaniteSrv: CyaniteSdkService) {

    }

  @Get('library')
  getCyaniteLibrary(){
    return this.cyaniteSrv.getLibrary({});
  }

  @Get('song/:id')
  @ApiParam({type: String, name: 'id'})
  getSong(@Param('id') id) {
    return this.cyaniteSrv.getSongAnalysis(id)
  }

  @Post('trigger')
  async triggerProcessing(@Body() data: TriggerPayload) {
    const res = await this.cyaniteSrv.triggerSongAnalysisFromYouTube(data.youTubeUrl)
    if (res.youTubeTrackEnqueue.__typename === 'YouTubeTrackEnqueueError') {
      console.warn(res.youTubeTrackEnqueue)
    }
    return res
  }

  @Post('webhook')
  webhook(@Body() data: CyaniteWebhookPayload) {
    console.log(data)
  }
}
