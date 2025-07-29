import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { LOCALE_NAMES } from '@waha/apps/chatwoot/locale';

interface LanguageResponse {
  name: string;
  locale: string;
}

@Controller('api/apps/chatwoot')
@ApiSecurity('api_key')
@ApiTags('🧩 Apps')
export class ChatwootLocalesController {
  @Get('locales')
  @ApiOperation({
    summary: 'Get available languages for Chatwoot app',
    description: 'Get available languages for Chatwoot app',
  })
  getLanguages(): LanguageResponse[] {
    return Array.from(LOCALE_NAMES.entries()).map(([locale, name]) => ({
      name,
      locale,
    }));
  }
}
