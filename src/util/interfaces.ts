import { ApiProperty } from '@nestjs/swagger';

export class SyncItem {
  @ApiProperty()
  provider: string;

  @ApiProperty()
  trackId: string;
}

export interface ProviderService {
  toSyncItem(url: string): SyncItem | null;
}
