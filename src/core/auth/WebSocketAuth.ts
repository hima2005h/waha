import * as url from 'url';

import { validateApiKey } from './apiKey.strategy';

export class WebSocketAuth {
  private key: string;

  constructor() {
    this.key = process.env.WHATSAPP_API_KEY || '';
  }

  verifyClient = (info: any, callback: any) => {
    if (!this.key) {
      callback(true);
      return;
    }
    // Do something with the info
    let query = url.parse(info.req.url, true).query;
    // case insensitive
    query = Object.keys(query).reduce((acc, key) => {
      acc[key.toLowerCase()] = query[key];
      return acc;
    }, {});

    const apiKey = query['x-api-key'];
    // @ts-ignore
    const isValid = validateApiKey(apiKey, this.key);
    callback(isValid);
  };
}
