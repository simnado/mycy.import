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

  findMany(options: { geniusIds?: string[]; spotifyId?: string } = {}) {
    const filterOptions: FindOptionsWhere<MatchedSong> = {
      ...(options.geniusIds ? { geniusId: In(options.geniusIds) } : {}),
      ...(options.spotifyId ? { spotifyId: options.spotifyId } : {}),
    };
    return this.repository.find({ where: filterOptions });
  }

  findOne(id: number): Promise<MatchedSong | null> {
    return this.repository.findOneBy({ id: id });
  }

  createOne(data: Partial<MatchedSong>) {
    const match = this.repository.create(data);
    return this.repository.save(match);
  }

  async updateOne(id: number, data: Partial<MatchedSong>) {
    const match = await this.repository.findOneBy({ id });
    await this.repository.update(id, { ...match, ...data });
    return await this.repository.findOneBy({ id });
  }
}
