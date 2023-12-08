import { Module } from '@nestjs/common';
import { AppleMusicService } from './apple-music.service';

@Module({
  providers: [AppleMusicService],
  exports: [AppleMusicService],
})
export class AppleMusicModule {}
