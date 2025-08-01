import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TextModule } from 'src/text/text.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [TelegramService, ConfigService],
  imports: [TextModule, ConfigModule],
})
export class TelegramModule {}
