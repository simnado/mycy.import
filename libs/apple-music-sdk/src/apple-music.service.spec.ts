import { Test, TestingModule } from '@nestjs/testing';
import { AppleMusicService } from './apple-music.service';

describe('AppleMusicService', () => {
  let service: AppleMusicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppleMusicService],
    }).compile();

    service = module.get<AppleMusicService>(AppleMusicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
