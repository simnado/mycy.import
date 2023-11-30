import { Test, TestingModule } from '@nestjs/testing';
import { GeniusService } from './genius.service';

describe('GeniusService', () => {
  let service: GeniusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeniusService],
    }).compile();

    service = module.get<GeniusService>(GeniusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
