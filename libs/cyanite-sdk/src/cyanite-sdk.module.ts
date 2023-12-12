import { Module } from '@nestjs/common';
import { CyaniteSdkService } from './cyanite-sdk.service';
import { CyaniteController } from './cyanite.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule],
  providers: [CyaniteSdkService],
  exports: [CyaniteSdkService],
  controllers: [CyaniteController],
})
export class CyaniteSdkModule {}
