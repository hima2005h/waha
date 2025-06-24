import { Injectable } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import { IncomingMessage } from 'http';
import * as url from 'url';

import { validateApiKey } from './apiKey.strategy';

@Injectable()
export class WebSocketAuth {
  private readonly key: string;

  constructor(private config: WhatsappConfigService) {
    this.key = this.config.getApiKey();
  }

  validateRequest(request: IncomingMessage) {
    if (!this.key) {
      return true;
    }
    const provided = this.getKeyFromQueryParams(request);
    return validateApiKey(provided, this.key);
  }

  private getKeyFromQueryParams(request: IncomingMessage) {
    let query = url.parse(request.url, true).query;
    // case-insensitive query params
    query = Object.keys(query).reduce((acc, key) => {
      acc[key.toLowerCase()] = query[key];
      return acc;
    }, {});

    const provided = query['x-api-key'];
    // Check if it's array - return first
    if (Array.isArray(provided)) {
      return provided[0];
    }
    return provided;
  }
}
