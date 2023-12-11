import { Injectable } from '@nestjs/common';
import { SyncRequestGroup } from './app.controller';
import { MatchService } from './matching/match/match.service';
import { GeniusService } from './genius/genius.service';

@Injectable()
export class AppService {
  constructor(
    private matchSrv: MatchService,
    private geniusSrv: GeniusService,
  ) {}

  async syncItems(items: SyncRequestGroup[]) {
    // put items in map
    const itemSet = new Map<string, SyncRequestGroup>();
    for (const item of items) {
      itemSet.set(item.geniusId, item);
    }

    const res = {
      existing: 0,
      created: 0,
      failed: 0,
      errors: [],
    };

    const dbMatches = await this.matchSrv.findMany({
      geniusIds: items.map((i) => i.geniusId),
    });

    // set existitng
    for (const dbMatch of dbMatches) {
      res.existing++;
      itemSet.delete(dbMatch.geniusId);
    }

    // loop over remaining
    for (const item of Array.from(itemSet.values())) {
      // todo: support other services besides genius
      const details = await this.geniusSrv.details(item.geniusId, {
        withRelations: true,
      });

      // if extreanlid include spotify, store in db, update res
      if (details.spotifyId) {
        await this.matchSrv.createOne(details);
        res.created++;
      } else {
        res.failed++;
      }

      // todo: ggf merge

      // set status and trigger spotify
    }

    return res;
  }
}
