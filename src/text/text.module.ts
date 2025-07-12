import { Module } from '@nestjs/common';
import { TextService } from './text.service';
import { TextController } from './text.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TextDocument, TextSchema } from 'src/database/text.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TextDocument.name, schema: TextSchema },
    ]),
  ],
  providers: [TextService],
  controllers: [TextController],
})
export class TextModule {}
