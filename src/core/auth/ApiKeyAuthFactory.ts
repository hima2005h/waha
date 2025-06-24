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
      'WARNING: Plain text API key detected. This is a security risk.',
    );
    logger.warn(
      'Your API key can be exposed in environment variables or process lists.',
    );
    logger.warn(
      'For better security, use WAHA_API_KEY=sha512:{SHA512_HASH_FOR_YOUR_API_KEY}',
    );
    logger.warn('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
  }, 2000);
  return new PlainApiKeyAuth(apiKey);
}
