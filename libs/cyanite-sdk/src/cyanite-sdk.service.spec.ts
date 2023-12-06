import { Test, TestingModule } from '@nestjs/testing';
import { CyaniteSdkService } from './cyanite-sdk.service';

describe('CyaniteSdkService', () => {
  let service: CyaniteSdkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CyaniteSdkService],
    }).compile();

    service = module.get<CyaniteSdkService>(CyaniteSdkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
