import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import { Match } from './match.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MatchService {
    constructor(
        @InjectRepository(Match)
        private repository: Repository<Match>,
      ) {}

    findMany() {
        return this.repository.find();
    }
    
    findOne(id: string): Promise<Match | null> {
        return this.repository.findOneBy({ geniusId: id });
    }

    createOne(data: Partial<Match>) {
        const match = this.repository.create(data);
        this.repository.save(match);
        return match;
    }
}
