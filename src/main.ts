/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { ContextIdFactory, NestFactory } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { main as mainSwagger } from './swagger';
import { Logger as NestLogger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  app.use(bodyParser.json({ limit: '20mb' }));

  mainSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  NestLogger.log(`Application is running on: http://localhost:${port}`);
}

void bootstrap();
