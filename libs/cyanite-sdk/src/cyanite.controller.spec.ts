import { Test, TestingModule } from '@nestjs/testing';
import { CyaniteController } from './cyanite.controller';

describe('CyaniteController', () => {
  let controller: CyaniteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CyaniteController],
    }).compile();

    controller = module.get<CyaniteController>(CyaniteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
