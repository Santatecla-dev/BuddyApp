import { Test, TestingModule } from '@nestjs/testing';
import { DivesController } from './dives.controller';

describe('DivesController', () => {
  let controller: DivesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DivesController],
    }).compile();

    controller = module.get<DivesController>(DivesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
