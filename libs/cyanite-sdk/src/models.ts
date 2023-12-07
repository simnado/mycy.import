import { ApiProperty } from '@nestjs/swagger';

export class CyaniteWebhookPayloadResource {
    @ApiProperty()
    type: 'LibraryTrack' | 'SpotifyTrack'

    @ApiProperty()
    id: string
}

export class CyaniteWebhookPayloadEvent {
    @ApiProperty()
    type: "AudioAnalysisV6" |
    "InDepthAnalysis"

    @ApiProperty()
    status: "finished" | "failed"
}

export class CyaniteWebhookPayload {
    @ApiProperty()
    id: string

    @ApiProperty()
    version: string

    @ApiProperty()
    resource: CyaniteWebhookPayloadResource

    @ApiProperty()
    event: CyaniteWebhookPayloadEvent
}