import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  PreconditionFailedException,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiParam, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CyaniteWebhookPayload } from './models';
import { CyaniteSdkService } from './cyanite-sdk.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export class TriggerPayload {
  @ApiProperty()
  youTubeUrl?: string;

  @ApiProperty()
  spotifyId?: string;
}

@ApiTags('Cyanite')
@Controller('cy')
export class CyaniteController {
  constructor(
    @Inject(CyaniteSdkService) private readonly cyaniteSrv: CyaniteSdkService,
    @Inject(EventEmitter2) private eventEmitter: EventEmitter2,
  ) {}

  @Get('library')
  getCyaniteLibrary() {
    return this.cyaniteSrv.getLibrary({});
  }

  @Get('library/:id')
  @ApiParam({ type: String, name: 'id' })
  getSong(@Param('id') id) {
    return this.cyaniteSrv.getSongAnalysisFromLibrary(id);
  }

  @Get('lookup')
  @ApiQuery({ type: String, name: 'spotifyId' })
  getSpotifyAnalysis(@Query('spotifyId') id) {
    return this.cyaniteSrv.getSongAnalysisFromSpotify(id);
  }

  @Post('analyse')
  async triggerProcessing(@Body() data: TriggerPayload) {
    if (data.spotifyId) {
      const res = await this.cyaniteSrv.triggerSongAnalysisFromSpotify(
        data.spotifyId,
      );
      if (res.spotifyTrackEnqueue.__typename === 'SpotifyTrackEnqueueError') {
        console.warn(res.spotifyTrackEnqueue);
      }
      return res;
    } else if (data.youTubeUrl) {
      const res = await this.cyaniteSrv.triggerSongAnalysisFromYouTube(
        data.youTubeUrl,
      );
      if (res.youTubeTrackEnqueue.__typename === 'YouTubeTrackEnqueueError') {
        console.warn(res.youTubeTrackEnqueue);
      }
      return res;
    } else {
      throw new UnprocessableEntityException(
        'neither youTubeId nor spotifyId was set',
      );
    }
  }

  @Post('webhook')
  webhook(@Body() data: CyaniteWebhookPayload) {
    console.log(data);
    if (data.event) {
      this.eventEmitter.emit(`cyanite.${data.event.type}`, data);
    }
  }
}
