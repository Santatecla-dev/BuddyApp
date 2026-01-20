import { Test, TestingModule } from '@nestjs/testing';
import { DivesService } from './dives.service';

describe('DivesService', () => {
  let service: DivesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DivesService],
    }).compile();

    service = module.get<DivesService>(DivesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
