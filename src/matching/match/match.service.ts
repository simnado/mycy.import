import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import { MatchedSong } from './match.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(MatchedSong)
    private repository: Repository<MatchedSong>,
  ) {}

  findMany() {
    return this.repository.find();
  }

  findOne(id: string): Promise<MatchedSong | null> {
    return this.repository.findOneBy({ geniusId: id });
  }

  createOne(data: Partial<MatchedSong>) {
    const match = this.repository.create(data);
    this.repository.save(match);
    return match;
  }
}
