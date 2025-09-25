export type ConversationId = number;

export interface IConversationCache {
  get(key: string): ConversationId | null;
  set(key: string, value: ConversationId): void;
  has(key: string): boolean;
  delete(key: string): void;
  clean(): void;
}
