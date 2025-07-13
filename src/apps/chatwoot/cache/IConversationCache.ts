import { public_conversation } from '@figuro/chatwoot-sdk';

export interface IConversationCache {
  get(key: string): public_conversation | null;
  set(key: string, value: public_conversation): void;
  has(key: string): boolean;
  delete(key: string): void;
  clean(): void;
}
