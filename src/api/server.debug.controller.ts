import v8 from 'node:v8';

import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { WhatsappConfigService } from '@waha/config.service';

@ApiSecurity('api_key')
@Controller('api/server/debug')
@ApiTags('🔍 Observability')
export class ServerDebugController {
  private logger: Logger;
  private readonly enabled: boolean;

  constructor(protected config: WhatsappConfigService) {
    this.logger = new Logger('ServerDebugController');
    this.enabled = this.config.debugModeEnabled;
  }

  @Get('heapsnapshot')
  @ApiOperation({
    summary: 'Return a heapsnapshot',
    description: "Return a heapsnapshot of the server's memory",
  })
  async heapsnapshot() {
    if (!this.enabled) {
      throw new NotFoundException('WAHA_DEBUG_MODE is disabled');
    }
    this.logger.log('Creating a heap snapshot...');
    const heap = v8.getHeapSnapshot();
    const fileName = `${Date.now()}.heapsnapshot`;
    return new StreamableFile(heap, {
      type: 'application/octet-stream',
      disposition: `attachment; filename=${fileName}`,
    });
  }
}
