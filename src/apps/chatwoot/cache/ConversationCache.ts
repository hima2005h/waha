import { public_conversation } from '@figuro/chatwoot-sdk';
import { ChatWootAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import * as NodeCache from 'node-cache';

import { IConversationCache } from './IConversationCache';

const cache: NodeCache = new NodeCache({
  stdTTL: 24 * 60 * 60, // 1 day
  useClones: false,
});

export function CacheForConfig(config: ChatWootAPIConfig): ConversationCache {
  return new ConversationCache(`${config.url}+${config.inboxId}`);
}

class ConversationCache implements IConversationCache {
  constructor(private prefix: string) {}

  fullKey(key: string) {
    return `${this.prefix}.${key}`;
  }

  delete(key: string): void {
    const fullKey = this.fullKey(key);
    cache.del(fullKey);
  }

  get(key: string): public_conversation | null {
    const fullKey = this.fullKey(key);
    return cache.get(fullKey) || null;
  }

  has(key: string): boolean {
    const fullKey = this.fullKey(key);
    return cache.has(fullKey);
  }

  set(key: string, value: public_conversation): void {
    const fullKey = this.fullKey(key);
    cache.set(fullKey, value);
  }

  /**
   * Completely clean the cache with the prefix
   */
  clean() {
    cache.keys().forEach((key) => {
      if (key.startsWith(this.prefix)) {
        cache.del(key);
      }
    });
  }
}
