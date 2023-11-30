import { Injectable } from '@nestjs/common';
import * as api from 'genius-api';

@Injectable()
export class GeniusService {

    protected sdk = new api(process.env.GENIUS_ACCESS_TOKEN);

    async search(q: string) {
        const res = await this.sdk.search(q);
        const {hits} = res;
        return hits.filter(hit => hit.type === 'song').map(hit => ({
            id: hit.result.id,
            title: hit.result.full_title,
            thumbnail: hit.result.header_image_thumbnail_url,
            releaseDate: hit.result.release_date_for_display,
        }));
    }

    async details(id: string) {
        const res = await this.sdk.song(id);
        // todo: map relevant fields
        return res.song;
    }
}
