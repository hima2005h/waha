import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  AppsService,
  IAppsService,
} from '@waha/apps/app_sdk/services/IAppsService';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { WAHAValidationPipe } from '@waha/nestjs/pipes/WAHAValidationPipe';

import { App } from '../dto/app.dto';
import { ListAppsQuery } from '../dto/query.dto';

@ApiSecurity('api_key')
@Controller('api/apps')
@ApiTags('🧩 Apps')
export class AppsController {
  constructor(
    @Inject(AppsService)
    private appsService: IAppsService,
    private manager: SessionManager,
  ) {}

  @Get('/')
  @ApiOperation({ summary: 'List all apps for a session' })
  @UsePipes(new WAHAValidationPipe())
  async list(
    @Query(new WAHAValidationPipe()) query: ListAppsQuery,
  ): Promise<App[]> {
    return this.appsService.list(this.manager, query.session);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create a new app' })
  @UsePipes(new WAHAValidationPipe())
  async create(@Body() app: App): Promise<App> {
    return await this.appsService.create(this.manager, app);
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Update an existing app' })
  @UsePipes(new WAHAValidationPipe())
  async update(@Param('id') id: string, @Body() app: App): Promise<void> {
    if (!app.id) {
      app.id = id;
    } else if (app.id !== id) {
      throw new NotFoundException(
        `App ID in path (${id}) does not match ID in body (${app.id})`,
      );
    }

    await this.appsService.update(this.manager, app);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete an app' })
  @UsePipes(new WAHAValidationPipe())
  async delete(@Param('id') id: string): Promise<void> {
    await this.appsService.delete(this.manager, id);
  }
}
