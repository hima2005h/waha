import * as v8 from 'node:v8';

import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  StreamableFile,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { WhatsappConfigService } from '@waha/config.service';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { WhatsappSession } from '@waha/core/abc/session.abc';
import {
  SessionApiParam,
  WorkingSessionParam,
} from '@waha/nestjs/params/SessionApiParam';
import { WAHAValidationPipe } from '@waha/nestjs/pipes/WAHAValidationPipe';
import { BrowserTraceQuery } from '@waha/structures/server.debug.dto';
import { createReadStream } from 'fs';

@ApiSecurity('api_key')
@Controller('api/server/debug')
@ApiTags('🔍 Observability')
export class ServerDebugController {
  private logger: Logger;
  private readonly enabled: boolean;

  constructor(
    private config: WhatsappConfigService,
    private manager: SessionManager,
  ) {
    this.logger = new Logger('ServerDebugController');
    this.enabled = this.config.debugModeEnabled;
  }

  @Get('heapsnapshot')
  @ApiOperation({
    summary: 'Return a heapsnapshot for the current nodejs process',
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

  @Get('browser/trace/:session')
  @ApiOperation({
    summary: 'Collect and get a trace.json for Chrome DevTools ',
    description: 'Uses https://pptr.dev/api/puppeteer.tracing',
  })
  @SessionApiParam
  @UsePipes(new WAHAValidationPipe())
  async browserTrace(
    @WorkingSessionParam session: WhatsappSession,
    @Query() query: BrowserTraceQuery,
  ) {
    if (!this.enabled) {
      throw new NotFoundException('WAHA_DEBUG_MODE is disabled');
    }
    const filepath = await session.browserTrace(query);
    const stream = createReadStream(filepath);
    const filename = `trace - ${session.name} - ${new Date()}.json`;
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename=${filename}`,
    });
  }
}
