import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'text',
  timestamps: true,
})
export class TextDocument extends Document {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  lang: string;

  @Prop({ required: true })
  cleaned: string;

  @Prop({ required: true })
  confidence: number;

  @Prop({ required: true })
  durationMs: number;

  @Prop({ required: true })
  languageName: string;
}
export const TextSchema = SchemaFactory.createForClass(TextDocument);
