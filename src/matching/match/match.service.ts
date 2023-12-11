import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import { MatchedSong } from './match.entity';
import { FindOptions, FindOptionsWhere, In, Like, Repository } from 'typeorm';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(MatchedSong)
    private repository: Repository<MatchedSong>,
  ) {}

  findMany(options: { geniusIds?: string[] }) {
    const filterOptions: FindOptionsWhere<MatchedSong> = {};
    if (options.geniusIds) {
      filterOptions.geniusId = In(options.geniusIds);
    }
    return this.repository.find({ where: filterOptions });
  }

  findOne(id: number): Promise<MatchedSong | null> {
    return this.repository.findOneBy({ id: id });
  }

  createOne(data: Partial<MatchedSong>) {
    const match = this.repository.create(data);
    this.repository.save(match);
    return match;
  }
}
