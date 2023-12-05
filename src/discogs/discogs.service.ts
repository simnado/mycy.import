import { Injectable } from '@nestjs/common';
import { Client } from 'disconnect';

@Injectable()
export class DiscogsService {

    protected readonly db = new Client({userToken: 'HrLSqumSvYtAEEgLVvmEfoilelmrGWEdYJEViJbB'}).database();

    async search(q: string) {
        return this.db.search(q)
    }
}
