import { LoggerService } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import {
  HashAuth,
  IApiKeyAuth,
  NoAuth,
  PlainApiKeyAuth,
} from '@waha/core/auth/auth';

export function ApiKeyAuthFactory(
  config: WhatsappConfigService,
  logger: LoggerService,
): IApiKeyAuth {
  const apiKey = config.getApiKey();
  if (!apiKey) {
    return new NoAuth();
  }

  if (apiKey.startsWith('sha512:')) {
    const hash = apiKey.slice(7);
    return new HashAuth(hash, 'sha512');
  }

  // Fallback to plain text
  setTimeout(() => {
    logger.warn('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
    logger.warn(
      'You are setting plain api key in WAHA_API_KEY (or WHATSAPP_API_KEY). Use hashed API key with "WAHA_API_KEY=sha512:{SHA512_HASH_FOR_YOUR_API_KEY}"️',
    );
    logger.warn('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
  }, 2000);
  return new PlainApiKeyAuth(apiKey);
}
