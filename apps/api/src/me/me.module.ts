import { Module } from '@nestjs/common';
import { ComercioModule } from '../comercio/comercio.module';
import { MeController } from './me.controller';

@Module({
  imports: [ComercioModule],
  controllers: [MeController],
})
export class MeModule {}
