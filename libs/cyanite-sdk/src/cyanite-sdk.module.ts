import { Module } from '@nestjs/common';
import { CyaniteSdkService } from './cyanite-sdk.service';
import { CyaniteController } from './cyanite.controller';

@Module({
  providers: [CyaniteSdkService],
  exports: [CyaniteSdkService],
  controllers: [CyaniteController]
})
export class CyaniteSdkModule {}
