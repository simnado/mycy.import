import { Injectable } from '@nestjs/common';
import { SyncRequestGroup } from './app.controller';
import { MatchService } from './matching/match/match.service';
import { GeniusService } from './genius/genius.service';
import {
  CyaniteSdkService,
  CyaniteWebhookPayload,
} from '@narendev/cyanite-sdk';
import { ModelTypes, ValueTypes } from '@narendev/cyanite-sdk/sdk/zeus';
import { AnalyzeStatus, MatchedSong } from './matching/match/match.entity';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class AppService {
  constructor(
    private matchSrv: MatchService,
    private geniusSrv: GeniusService,
    private cyaniteSrv: CyaniteSdkService,
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
      if (!details.spotifyId) {
        res.failed++;
      } else {
        const song = await this.matchSrv.createOne(details);
        res.created++;

        // query spotify analysis and process results
        await this.handleSpotifyTrack(song, { startTrigger: true });
      }

      // todo: ggf merge
    }

    return res;
  }

  async handleSpotifyTrack(
    song: MatchedSong,
    options: { startTrigger?: boolean } = {},
  ) {
    const cyaniteRes = await this.cyaniteSrv.getSongAnalysisFromSpotify(
      song.spotifyId,
    );
    console.log(cyaniteRes.spotifyTrack.__typename);
    console.log(options);
    switch (cyaniteRes.spotifyTrack.__typename) {
      case 'SpotifyTrack':
        this.handleSpotifyTrackMatch(
          song,
          cyaniteRes.spotifyTrack.audioAnalysisV6,
          options.startTrigger,
        );
        break;
      case 'SpotifyTrackError':
        this.handleSpotifyTrackError(song, cyaniteRes.spotifyTrack.message);
    }
  }

  async handleSpotifyTrackMatch(
    song: MatchedSong,
    audioAnalysisV6: ModelTypes['AudioAnalysisV6'],
    startTriggerOnDemand = false,
  ) {
    console.log(audioAnalysisV6.__typename);
    console.log(startTriggerOnDemand);
    switch (audioAnalysisV6.__typename) {
      case 'AudioAnalysisV6NotStarted':
        // trigger analysis
        if (startTriggerOnDemand) {
          const enqueueResult =
            await this.cyaniteSrv.triggerSongAnalysisFromSpotify(
              song.spotifyId,
            );
          if (
            enqueueResult.spotifyTrackEnqueue.__typename ===
            'SpotifyTrackEnqueueError'
          ) {
            const updatedStatus = song.youTubeId
              ? AnalyzeStatus.CompleteAnalyzable
              : AnalyzeStatus.PreviewUnavailable;
            await this.matchSrv.updateOne(song.id, {
              analyzeStatus: updatedStatus,
            });
          } else {
            await this.matchSrv.updateOne(song.id, {
              analyzeStatus: AnalyzeStatus.PreviewAnalyzing,
            });
          }
        } else {
          console.warn(`ignore AudioAnalysisNotStarted`);
        }
        break;
      case 'AudioAnalysisV6Enqueued':
        console.warn('weird state spotify status AudioAnalysisV6Enqueued');
        break;
      case 'AudioAnalysisV6Processing':
        await this.matchSrv.updateOne(song.id, {
          analyzeStatus: AnalyzeStatus.PreviewAnalyzing,
        });
        break;
      case 'AudioAnalysisV6Finished':
        // update status and result
        await this.matchSrv.updateOne(song.id, {
          analyzeStatus: AnalyzeStatus.PreviewAnalyzed,
          analyzeResult: (
            audioAnalysisV6 as ModelTypes['AudioAnalysisV6Finished']
          ).result,
        });
        break;
      case 'AudioAnalysisV6Failed':
        const updatedStatus = song.youTubeId
          ? AnalyzeStatus.CompleteAnalyzable
          : AnalyzeStatus.PreviewUnavailable;
        await this.matchSrv.updateOne(song.id, {
          analyzeStatus: updatedStatus,
        });
        break;
    }
  }

  handleSpotifyTrackError(song: MatchedSong, message: string) {
    console.warn(`invalid spotify id detected: ${song.spotifyId} [${message}]`);
    const updatedStatus = song.youTubeId
      ? AnalyzeStatus.CompleteAnalyzable
      : AnalyzeStatus.PreviewUnavailable;
    this.matchSrv.updateOne(song.id, { analyzeStatus: updatedStatus });
  }

  @OnEvent('cyanite.AudioAnalysisV6')
  async handleOrderCreatedEvent(payload: CyaniteWebhookPayload) {
    // !!! THIS ONLY WORKS FOR SPOTIFY YET !!!
    if (payload.resource.type === 'LibraryTrack') {
      console.warn(
        'handling library track during webhook is not supported yet',
      );
      return;
    }

    const songs = await this.matchSrv.findMany({
      spotifyId: payload.resource.id,
    });

    if (songs.length !== 1) {
      console.warn(
        `got ${songs.length} results for spotifyId ${payload.resource.id} instead of 1`,
      );
      return;
    }

    const song = songs.pop();

    switch (payload.event.status) {
      case 'failed':
        console.warn(
          `processing of ${payload.resource.type} ${payload.resource.id} failed`,
        );
        const updatedStatus = song.youTubeId
          ? AnalyzeStatus.CompleteAnalyzable
          : AnalyzeStatus.PreviewUnavailable;
        this.matchSrv.updateOne(song.id, { analyzeStatus: updatedStatus });
        break;
      case 'finished':
        this.handleSpotifyTrack(song, { startTrigger: false });
        break;
    }
  }
}
