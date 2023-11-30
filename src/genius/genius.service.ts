import { Injectable } from '@nestjs/common';
import * as api from 'genius-api';

@Injectable()
export class GeniusService {

    protected sdk = new api(process.env.GENIUS_ACCESS_TOKEN);

    async search(q: string) {
        const res = await this.sdk.search(q);
        return res;
    }
}
