import { Module } from '@nestjs/common';
import { CyaniteSdkService } from './cyanite-sdk.service';

@Module({
  providers: [CyaniteSdkService],
  exports: [CyaniteSdkService],
})
export class CyaniteSdkModule {}
