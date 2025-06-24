import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as crypto from 'crypto';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

import { WhatsappConfigService } from '../../config.service';

/**
 * Securely validates API key using constant-time comparison
 * @param providedKey The key provided in the request
 * @param storedKey The key stored in the configuration
 * @returns boolean indicating if the keys match
 */
export function validateApiKey(
  providedKey: string,
  storedKey: string | undefined,
): boolean {
  if (!storedKey || !providedKey) {
    return false;
  }

  try {
    // Convert strings to buffers for constant-time comparison
    const providedKeyBuffer = Buffer.from(providedKey);
    const storedKeyBuffer = Buffer.from(storedKey);

    // If lengths are different, return false but use a dummy comparison to prevent timing attacks
    if (providedKeyBuffer.length !== storedKeyBuffer.length) {
      // Create a dummy buffer of the same length as the provided key
      const dummyBuffer = Buffer.alloc(providedKeyBuffer.length);
      // Perform comparison with dummy buffer to maintain constant time
      crypto.timingSafeEqual(providedKeyBuffer, dummyBuffer);
      return false;
    }

    // Perform constant-time comparison
    return crypto.timingSafeEqual(providedKeyBuffer, storedKeyBuffer);
  } catch (error) {
    return false;
  }
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy) {
  constructor(private config: WhatsappConfigService) {
    super({ header: 'X-Api-Key', prefix: '' }, true, (apikey, done) => {
      const isValid = validateApiKey(apikey, this.config.getApiKey());
      return done(isValid);
    });
  }

  validate(apikey: string, done: (result: boolean) => void): void {
    const isValid = validateApiKey(apikey, this.config.getApiKey());
    return done(isValid);
  }
}
