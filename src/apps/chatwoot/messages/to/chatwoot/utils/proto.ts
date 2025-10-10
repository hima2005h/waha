import { WAMessage } from '@waha/structures/responses.dto';
import type { proto } from '@adiwajshing/baileys';
import * as lodash from 'lodash';

export function camelCaseKeysDeep<T = any>(input: unknown): T {
  if (Array.isArray(input)) return input.map(camelCaseKeysDeep) as unknown as T;
  if (input && typeof input === 'object') {
    const mapped = lodash.mapKeys(input as Record<string, unknown>, (_v, k) =>
      lodash.camelCase(k),
    );
    return lodash.mapValues(mapped, camelCaseKeysDeep) as unknown as T;
  }
  return input as T;
}

export function resolveProtoMessage(payload: WAMessage): proto.Message | null {
  // GOWS
  if (payload._data.Message) {
    const protoMessage = payload._data.Message;
    // mediaURL => mediaUrl
    // otherAttributes => otherAttributes
    return camelCaseKeysDeep(protoMessage);
  }

  // NOWEB
  if (payload._data.message) {
    return payload._data.message;
  }
  // WEBJS - not available
  return null;
}

export function isEmptyString(content: string) {
  if (!content) {
    return true;
  }
  return content === '' || content === '\n';
}
