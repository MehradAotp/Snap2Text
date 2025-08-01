import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';
import { TextModule } from './text/text.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
      }),
    }),
    TextModule,
    TelegramModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
