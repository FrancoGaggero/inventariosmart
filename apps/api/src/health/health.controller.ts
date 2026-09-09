import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Health } from '@inventariosmart/shared';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { HealthDto } from './health.dto';

@ApiTags('sistema')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado de la API y de la conexión a la base de datos' })
  @ApiOkResponse({ type: HealthDto })
  async health(): Promise<Health> {
    const db = (await this.prisma.ping()) ? 'ok' : 'error';
    return {
      status: 'ok',
      db,
      version: process.env['npm_package_version'] ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
