import { Injectable } from '@nestjs/common';
import { Chain, ModelTypes, Selector, ValueTypes } from './sdk/zeus';

const audioAnalysisV6CompleteFragment: ValueTypes['AudioAnalysisV6'] = {
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
        electronicDance: true,
        folkCountry: true,
        funkSoul: true,
        jazz: true,
        latin: true,
        metal: true,
        pop: true,
        rapHipHop: true,
        reggae: true,
        rnb: true,
        rock: true,
        singerSongwriter: true,
      },
      genreTags: true,
      //todo: missing fields
      bpmRangeAdjusted: true,
    },
  },
  ['...on AudioAnalysisV6Failed']: {
    error: {
      message: true,
    },
  },
};

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

  async getSongAnalysisFromSpotify(spotifyId) {
    return await this.agent('query')({
      spotifyTrack: [
        {
          id: spotifyId,
        },
        {
          __typename: true,
          ['...on SpotifyTrackError']: {
            message: true,
          },
          ['...on SpotifyTrack']: {
            id: true,
            title: true,
            audioAnalysisV6: audioAnalysisV6CompleteFragment,
          },
        },
      ],
    });
  }

  async getSongAnalysisFromLibrary(id: string) {
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
            audioAnalysisV6: audioAnalysisV6CompleteFragment,
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
              title: true,
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

  async triggerSongAnalysisFromSpotify(spotifyId: string) {
    return await this.agent('mutation')({
      spotifyTrackEnqueue: [
        {
          input: {
            spotifyTrackId: spotifyId,
          },
        },
        {
          __typename: true,
          ['...on SpotifyTrackEnqueueError']: {
            message: true,
          },
          ['...on SpotifyTrackEnqueueSuccess']: {
            enqueuedSpotifyTrack: {
              id: true,
              title: true,
            },
          },
        },
      ],
    });
  }
}
