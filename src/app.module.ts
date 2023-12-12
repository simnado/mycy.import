import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GeniusService } from './genius/genius.service';
import { ConfigModule } from '@nestjs/config';
import { DiscogsService } from './discogs/discogs.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchService } from './matching/match/match.service';
import { JobService } from './jobs/job/job.service';
import { MatchedSong } from './matching/match/match.entity';
import { CyaniteSdkModule } from '@narendev/cyanite-sdk';
import { AppleMusicModule } from '@narendev/apple-music-sdk';
import { SpotifyModule } from '@narendev/spotify-sdk';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [MatchedSong],
      synchronize: true,
      ssl: true,
      extra: { poolSize: 10 },
    }),
    EventEmitterModule.forRoot({ global: true }),
    TypeOrmModule.forFeature([MatchedSong]),
    CyaniteSdkModule,
    AppleMusicModule,
    SpotifyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    GeniusService,
    DiscogsService,
    MatchService,
    JobService,
  ],
})
export class AppModule {}
