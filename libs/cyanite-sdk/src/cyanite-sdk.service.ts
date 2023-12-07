import { Injectable } from '@nestjs/common';
import { Chain, ModelTypes, Selector, ValueTypes } from './sdk/zeus';

@Injectable()
export class CyaniteSdkService {
  public readonly gqlUrl = 'https://api.cyanite.ai/graphql';

  protected readonly agent = Chain(this.gqlUrl, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CYANITE_ACCESS_TOKEN}`,
    },
  });

  protected pageSelector = Selector('PageInfo')({
    hasNextPage: true,
  });

  async getLibrary(input: ValueTypes['LibraryTracksFilter']) {
    return await this.agent('query')({
      libraryTracks: [
        {},
        {
          pageInfo: this.pageSelector,
          edges: {
            cursor: true,
            node: {
              id: true,
              title: true,
              externalId: true,
              audioAnalysisV6: {
                __typename: true,
              },
            },
          },
        } as any,
      ],
    });
  }

  async getSongAnalysis(id: string) {
    return await this.agent('query')({
      libraryTrack: [
        {
          id,
        },
        {
          ['...on LibraryTrack']: {
            id: true,
            externalId: true,
            title: true,
            audioAnalysisV6: {
              __typename: true,
              ['...on AudioAnalysisV6Finished']: {
                result: {
                  segments: {
                    representativeSegmentIndex: true,
                    timestamps: true,
                    // todo: add values
                  },
                  genre: {
                    ambient: true,
                    blues: true,
                    classical: true,
                    country: true,
                    // todo: add fields
                  },
                },
              },
            },
          },
        } as any,
      ],
    });
  }

  async triggerSongAnalysisFromYouTube(url: string) {
    return await this.agent('mutation')({
      youTubeTrackEnqueue: [
        {
          input: {
            videoUrl: url,
          },
        },
        {
          __typename: true,
          ['...on YouTubeTrackEnqueueSuccess']: {
            enqueuedLibraryTrack: {
              id: true,
            },
          },
          ['...on YouTubeTrackEnqueueError']: {
            code: true,
            message: true,
          },
        },
      ],
    });
  }
}
